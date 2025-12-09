"""
Prompt 运行相关 API
支持真实 LLM 调用（通过 LiteLLM）
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
import re
import json
from typing import Optional
from sqlalchemy.orm import Session

try:
    import litellm
except ImportError:
    litellm = None  # 如果未安装，降级到 Mock 模式

from ..database import get_db
from .. import models
from .prompts import _get_latest_version

router = APIRouter(prefix="/api/v1/run", tags=["run"])


def _render_template(template: str, variables: dict) -> tuple[str, list[str]]:
    """渲染模板，替换变量"""
    errors = []

    def replace_var(match: re.Match):
        var = match.group(1)
        if var in variables:
            return str(variables[var])
        errors.append(var)
        return f"<MISSING:{var}>"

    result = re.sub(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", replace_var, template)
    return result, errors


@router.post("/translate")
async def translate_prompt(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    翻译提示词（中译英或英译中）
    
    请求体：
    {
        "text": "要翻译的文本",
        "from_lang": "zh" | "en",
        "to_lang": "zh" | "en",
        "api_key": "sk-xxx",  # 必需，BYOK 模式
        "model": "gpt-3.5-turbo"  # 可选
    }
    """
    text = payload.get("text", "")
    from_lang = payload.get("from_lang", "zh")
    to_lang = payload.get("to_lang", "en")
    api_key = payload.get("api_key")
    model = payload.get("model", "gpt-3.5-turbo")
    
    if not text:
        raise HTTPException(status_code=400, detail="文本内容不能为空")
    
    if not api_key:
        raise HTTPException(status_code=400, detail="API Key 不能为空")
    
    if not litellm:
        raise HTTPException(status_code=500, detail="LiteLLM 未安装，无法进行翻译")
    
    # 构建翻译提示词
    if from_lang == "zh":
        translate_prompt_text = f"""请将以下中文提示词翻译成英文，保持格式和变量（{{{{variable}}}}）不变，只翻译文本内容。不要添加任何解释或说明，直接返回翻译结果：

{text}"""
    else:
        translate_prompt_text = f"""Please translate the following English prompt to Chinese, keep the format and variables ({{{{variable}}}}) unchanged, only translate the text content. Do not add any explanations or notes, just return the translation result:

{text}"""
    
    try:
        response = await litellm.acompletion(
            model=model,
            messages=[{"role": "user", "content": translate_prompt_text}],
            api_key=api_key,
            temperature=0.3,
        )
        
        translated_text = response.choices[0].message.content if response.choices else ""
        
        return {
            "original_text": text,
            "translated_text": translated_text.strip(),
            "from_lang": from_lang,
            "to_lang": to_lang,
            "model": model,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"翻译失败: {str(e)}"
        )


@router.post("/{prompt_slug}")
async def run_prompt(
    prompt_slug: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    运行 Prompt（变量注入 + 真实 LLM 调用）
    
    请求体：
    {
        "variables": {"user_name": "Alice", ...},
        "api_key": "sk-xxx",  # 可选，BYOK 模式
        "model": "gpt-4o",     # 可选，默认从 config_json 读取
        "stream": false        # 是否流式输出
    }
    """
    prompt = db.query(models.Prompt).filter(models.Prompt.slug == prompt_slug).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt (slug) 不存在")
    version = _get_latest_version(prompt)
    if not version:
        raise HTTPException(status_code=404, detail="Prompt 无可用版本")
    
    # 支持 JSON 格式的 compiled_template：{"zh": "...", "en": "..."}
    # 兼容旧数据（字符串格式）
    lang = payload.get("lang", "zh")  # 默认使用中文
    if isinstance(version.compiled_template, dict):
        # 优先使用指定语言，如果为空则使用另一种语言，最后使用中文
        template = version.compiled_template.get(lang, "") or \
                   version.compiled_template.get("en" if lang == "zh" else "zh", "") or \
                   version.compiled_template.get("zh", "") or \
                   version.compiled_template.get("en", "")
    else:
        template = version.compiled_template or ""
    variables = payload.get("variables") or {}
    api_key = payload.get("api_key")  # BYOK 模式
    model = payload.get("model") or (version.config_json.get("model_name") if version.config_json else "gpt-3.5-turbo")
    stream = payload.get("stream", False)
    
    # 渲染模板
    rendered_prompt, errors = _render_template(template, variables)
    
    if errors:
        # 如果有缺失变量，返回错误
        return {
            "result": rendered_prompt,
            "variables": variables,
            "template": template,
            "errors": errors,
            "llm_response": None,
            "error": f"缺失变量: {', '.join(errors)}",
        }
    
    # 如果没有安装 litellm 或未提供 API Key，返回渲染后的文本（Mock 模式）
    if not litellm or not api_key:
        return {
            "result": rendered_prompt,
            "variables": variables,
            "template": template,
            "errors": [],
            "llm_response": "[Mock 模式] 请提供 API Key 以调用真实 LLM",
            "note": "安装 litellm 并提供 api_key 参数以启用真实 LLM 调用",
        }
    
    try:
        # 调用真实 LLM
        if stream:
            # 流式输出（SSE）
            async def generate():
                try:
                    response = await litellm.acompletion(
                        model=model,
                        messages=[{"role": "user", "content": rendered_prompt}],
                        api_key=api_key,
                        stream=True,
                    )
                    async for chunk in response:
                        if chunk.choices[0].delta.content:
                            yield f"data: {json.dumps({'content': chunk.choices[0].delta.content})}\n\n"
                    yield "data: [DONE]\n\n"
                except Exception as e:
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
            
            return StreamingResponse(generate(), media_type="text/event-stream")
        else:
            # 非流式输出
            response = await litellm.acompletion(
                model=model,
                messages=[{"role": "user", "content": rendered_prompt}],
                api_key=api_key,
            )
            
            llm_content = response.choices[0].message.content if response.choices else ""
            
            return {
                "result": rendered_prompt,
                "variables": variables,
                "template": template,
                "errors": [],
                "llm_response": llm_content,
                "model": model,
            }
    except Exception as e:
        return {
            "result": rendered_prompt,
            "variables": variables,
            "template": template,
            "errors": [],
            "llm_response": None,
            "error": f"LLM 调用失败: {str(e)}",
        }

