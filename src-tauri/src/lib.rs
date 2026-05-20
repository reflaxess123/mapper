use tauri::Manager;
use std::fs;
use std::time::SystemTime;

#[derive(serde::Serialize, serde::Deserialize)]
struct OpenRouterMessage {
    role: String,
    content: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct OpenRouterRequest {
    model: String,
    messages: Vec<OpenRouterMessage>,
}

#[derive(serde::Deserialize)]
struct OpenRouterChoiceMessage {
    content: Option<String>,
}

#[derive(serde::Deserialize)]
struct OpenRouterChoice {
    message: OpenRouterChoiceMessage,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct OpenRouterUsage {
    prompt_tokens: Option<u32>,
    completion_tokens: Option<u32>,
    total_tokens: Option<u32>,
}

#[derive(serde::Deserialize)]
struct OpenRouterResponse {
    choices: Option<Vec<OpenRouterChoice>>,
    error: Option<serde_json::Value>,
    usage: Option<OpenRouterUsage>,
}

#[derive(serde::Serialize)]
struct GenerationResponse {
    data: String,
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct MindMapMeta {
    id: String,
    name: String,
    modified: u64,
}

#[derive(serde::Deserialize)]
struct ShortMindMap {
    name: Option<String>,
}

/// Extracts a short, user-readable message from an OpenRouter error body.
/// OpenRouter wraps failures in `{ "error": { "code": .., "message": .. } }`;
/// when present we surface just the message so the UI banner stays
/// digestible instead of dumping the full JSON payload at the user.
fn friendly_openrouter_error(status: reqwest::StatusCode, body: &str) -> String {
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(err_obj) = json.get("error") {
            let msg = err_obj
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let code = err_obj
                .get("code")
                .and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.as_i64().map(|n| n.to_string())))
                .unwrap_or_default();
            if !msg.is_empty() {
                return if code.is_empty() {
                    format!("OpenRouter ({}): {}", status, msg)
                } else {
                    format!("OpenRouter ({} / {}): {}", status, code, msg)
                };
            }
        }
    }
    // Fall back to the raw body but trim absurdly long payloads.
    let trimmed = if body.len() > 600 {
        format!("{}…", &body[..600])
    } else {
        body.to_string()
    };
    format!("OpenRouter API error (status {}): {}", status, trimmed)
}

// Clean markdown code blocks from AI response
fn parse_json_from_llm(response: &str) -> Result<String, String> {
    let clean = response.trim();
    let mut parsed = clean;
    if let Some(start) = parsed.find("```json") {
        parsed = &parsed[start + 7..];
    } else if let Some(start) = parsed.find("```") {
        parsed = &parsed[start + 3..];
    }
    if let Some(end) = parsed.rfind("```") {
        parsed = &parsed[..end];
    }
    let parsed_str = parsed.trim().to_string();
    
    // Validate it is valid JSON
    let _: serde_json::Value = serde_json::from_str(&parsed_str)
        .map_err(|e| format!("Failed to parse JSON: {}. Raw: {}", e, parsed_str))?;
        
    Ok(parsed_str)
}

#[tauri::command]
async fn generate_mindmap(api_key: String, topic: String, model: String) -> Result<String, String> {
    let prompt = format!(
        "Generate a detailed, hierarchical mind map on the topic: \"{}\".\n\
         Return ONLY a valid JSON object matching the following structure. Do not output any markdown formatting, code blocks, or extra text.\n\
         \n\
         Schema:\n\
         {{\n\
           \"id\": \"root\",\n\
           \"name\": \"Topic Name\",\n\
           \"children\": [\n\
             {{\n\
               \"id\": \"subtopic-id-1\",\n\
               \"name\": \"Subtopic A\",\n\
               \"children\": [\n\
                 {{\n\
                   \"id\": \"sub-subtopic-id-1-1\",\n\
                   \"name\": \"Sub-subtopic A1\",\n\
                   \"children\": []\n\
                 }}\n\
               ]\n\
             }}\n\
           ]\n\
         }}\n\
         \n\
         Provide 3 to 5 main branches, and each main branch should have 2 to 4 sub-branches. Keep the names concise (1-5 words). Ensure the JSON is completely valid.",
        topic
    );

    let client = reqwest::Client::new();
    let res = client.post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://github.com/antigravity/mapper")
        .header("X-Title", "MindMapper")
        .json(&OpenRouterRequest {
            model,
            messages: vec![OpenRouterMessage {
                role: "user".to_string(),
                content: prompt,
            }],
        })
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = res.status();
    let body = res.text().await.map_err(|e| format!("Failed to read response body: {}", e))?;

    if !status.is_success() {
        return Err(friendly_openrouter_error(status, &body));
    }

    let response_data: OpenRouterResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse API response JSON: {}. Response: {}", e, body))?;

    if let Some(err) = response_data.error {
        // Same shape as the non-2xx branch but we got here with status 200
        // (e.g. OpenRouter returns 200 + error JSON for some upstream
        // model failures).
        let msg = err.get("message").and_then(|v| v.as_str()).unwrap_or("");
        let code = err
            .get("code")
            .and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.as_i64().map(|n| n.to_string())))
            .unwrap_or_default();
        if !msg.is_empty() {
            return Err(if code.is_empty() {
                format!("OpenRouter: {}", msg)
            } else {
                format!("OpenRouter ({}): {}", code, msg)
            });
        }
        return Err(format!("OpenRouter returned error: {}", err));
    }

    let choices = response_data.choices.ok_or("No choices returned from OpenRouter API")?;
    if choices.is_empty() {
        return Err("Empty choices returned from OpenRouter API".to_string());
    }

    let content = choices[0].message.content.as_ref().ok_or("No message content returned from OpenRouter API")?;
    
    let clean_json = parse_json_from_llm(content)?;
    let usage = response_data.usage.unwrap_or(OpenRouterUsage {
        prompt_tokens: Some(0),
        completion_tokens: Some(0),
        total_tokens: Some(0),
    });

    let resp = GenerationResponse {
        data: clean_json,
        prompt_tokens: usage.prompt_tokens.unwrap_or(0),
        completion_tokens: usage.completion_tokens.unwrap_or(0),
        total_tokens: usage.total_tokens.unwrap_or(0),
    };

    serde_json::to_string(&resp).map_err(|e| format!("Failed to serialize result: {}", e))
}

#[tauri::command]
async fn extend_node(api_key: String, topic_context: String, node_label: String, model: String) -> Result<String, String> {
    let prompt = format!(
        "We are building a mind map about the overarching theme: \"{}\".\n\
         We want to expand the specific node named: \"{}\".\n\
         Generate 3 to 5 highly relevant sub-branches (children) for this specific node.\n\
         Return ONLY a valid JSON array of these child nodes, matching the following structure. Do not output any markdown formatting, code blocks, or extra text.\n\
         \n\
         Schema:\n\
         [\n\
           {{\n\
             \"id\": \"unique-subtopic-id-1\",\n\
             \"name\": \"Child Subtopic Name 1\",\n\
             \"children\": []\n\
           }},\n\
           {{\n\
             \"id\": \"unique-subtopic-id-2\",\n\
             \"name\": \"Child Subtopic Name 2\",\n\
             \"children\": []\n\
           }}\n\
         ]\n\
         \n\
         Ensure the generated IDs are unique strings and the response is a valid JSON array.",
        topic_context, node_label
    );

    let client = reqwest::Client::new();
    let res = client.post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://github.com/antigravity/mapper")
        .header("X-Title", "MindMapper")
        .json(&OpenRouterRequest {
            model,
            messages: vec![OpenRouterMessage {
                role: "user".to_string(),
                content: prompt,
            }],
        })
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = res.status();
    let body = res.text().await.map_err(|e| format!("Failed to read response body: {}", e))?;

    if !status.is_success() {
        return Err(friendly_openrouter_error(status, &body));
    }

    let response_data: OpenRouterResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse API response JSON: {}. Response: {}", e, body))?;

    if let Some(err) = response_data.error {
        // Same shape as the non-2xx branch but we got here with status 200
        // (e.g. OpenRouter returns 200 + error JSON for some upstream
        // model failures).
        let msg = err.get("message").and_then(|v| v.as_str()).unwrap_or("");
        let code = err
            .get("code")
            .and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.as_i64().map(|n| n.to_string())))
            .unwrap_or_default();
        if !msg.is_empty() {
            return Err(if code.is_empty() {
                format!("OpenRouter: {}", msg)
            } else {
                format!("OpenRouter ({}): {}", code, msg)
            });
        }
        return Err(format!("OpenRouter returned error: {}", err));
    }

    let choices = response_data.choices.ok_or("No choices returned from OpenRouter API")?;
    if choices.is_empty() {
        return Err("Empty choices returned from OpenRouter API".to_string());
    }

    let content = choices[0].message.content.as_ref().ok_or("No message content returned from OpenRouter API")?;
    
    let clean_json = parse_json_from_llm(content)?;
    let usage = response_data.usage.unwrap_or(OpenRouterUsage {
        prompt_tokens: Some(0),
        completion_tokens: Some(0),
        total_tokens: Some(0),
    });

    let resp = GenerationResponse {
        data: clean_json,
        prompt_tokens: usage.prompt_tokens.unwrap_or(0),
        completion_tokens: usage.completion_tokens.unwrap_or(0),
        total_tokens: usage.total_tokens.unwrap_or(0),
    };

    serde_json::to_string(&resp).map_err(|e| format!("Failed to serialize result: {}", e))
}

#[tauri::command]
fn save_mindmap(app_handle: tauri::AppHandle, id: String, data: String) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    
    let file_path = app_dir.join(format!("{}.json", id));
    fs::write(&file_path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_mindmap(app_handle: tauri::AppHandle, id: String) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let file_path = app_dir.join(format!("{}.json", id));
    
    if !file_path.exists() {
        return Err("Mind map not found".to_string());
    }
    
    fs::read_to_string(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_mindmap(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let file_path = app_dir.join(format!("{}.json", id));
    
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn list_mindmaps(app_handle: tauri::AppHandle) -> Result<Vec<MindMapMeta>, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    if !app_dir.exists() {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();
    let entries = fs::read_dir(app_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
            let id = path.file_stem().unwrap().to_string_lossy().into_owned();
            let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
            let modified = metadata.modified()
                .unwrap_or(SystemTime::now())
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            // Try to extract name from JSON content
            let mut name = id.clone();
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(parsed) = serde_json::from_str::<ShortMindMap>(&content) {
                    if let Some(n) = parsed.name {
                        name = n;
                    }
                }
            }

            list.push(MindMapMeta { id, name, modified });
        }
    }

    // Sort by modified time descending (newest first)
    list.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(list)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            generate_mindmap,
            extend_node,
            save_mindmap,
            load_mindmap,
            delete_mindmap,
            list_mindmaps
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
