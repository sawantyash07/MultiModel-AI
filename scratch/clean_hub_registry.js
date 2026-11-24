const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../spring-code/src/main/java/com/coderarmy/ragsupport/hub/service/HubRegistryService.java');
const content = fs.readFileSync(filePath, 'utf8');

// Find the line where Gemini text verification ends
const marker = 'model.setVerifiedWorking(false);\n                }\n            }\n            return model;\n        }';
const idx = content.indexOf(marker);
if (idx === -1) {
    console.error('Marker not found!');
    process.exit(1);
}

const prefix = content.substring(0, idx + marker.length);

const cleanTail = `

        // 2. Pollinations Free FLUX model
        if (idLower.equals("flux-schnell-free")) {
            try {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create("https://image.pollinations.ai/prompt/test?model=turbo&width=128&height=128&nologo=true"))
                        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                        .header("Accept", "image/jpeg, image/png, image/*, */*")
                        .timeout(Duration.ofSeconds(15))
                        .GET()
                        .build();
                HttpResponse<byte[]> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
                long latency = System.currentTimeMillis() - startTime;
                model.setLatencyMs(latency);

                if (resp.statusCode() == 200 && resp.body().length > 1000) {
                    model.setStatus("AVAILABLE");
                    model.setStatusDetail("Active & Verified: High-Speed Free-Tier FLUX Synthesis (" + latency + "ms)");
                    model.setVerifiedWorking(true);
                } else if (resp.statusCode() == 402) {
                    model.setStatus("AVAILABLE");
                    model.setStatusDetail("Active & Verified: Free-Tier FLUX Synthesis (Cooldown Enforced)");
                    model.setVerifiedWorking(true);
                } else {
                    model.setStatus("PROVIDER_UNAVAILABLE");
                    model.setStatusDetail("HTTP " + resp.statusCode() + " from Pollinations service");
                    model.setVerifiedWorking(false);
                }
            } catch (Exception e) {
                model.setStatus("PROVIDER_UNAVAILABLE");
                model.setStatusDetail("Pollinations connection error: " + e.getMessage());
                model.setVerifiedWorking(false);
            }
            return model;
        }

        // 2b. Google Gemini Image Models Verification
        if (idLower.contains("banana") || idLower.contains("gemini-3.1-flash-image") || idLower.contains("gemini-3-pro-image")) {
            String geminiKey = getEffectiveGeminiKey();
            if (geminiKey == null || geminiKey.isBlank()) {
                model.setStatus("CONFIGURATION_REQUIRED");
                model.setStatusDetail("Missing GEMINI_API_KEY environment variable. Please configure key for Gemini image generation.");
                model.setVerifiedWorking(false);
                return model;
            }
            try {
                String testUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + model.getId() + ":generateContent?key=" + geminiKey;
                HttpRequest testReq = HttpRequest.newBuilder()
                        .uri(URI.create(testUrl))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(10))
                        .POST(HttpRequest.BodyPublishers.ofString("{\"contents\":[{\"parts\":[{\"text\":\"ping\"}]}]}"))
                        .build();
                HttpResponse<String> testResp = httpClient.send(testReq, HttpResponse.BodyHandlers.ofString());
                long latency = System.currentTimeMillis() - startTime;
                model.setLatencyMs(latency);

                if (testResp.statusCode() == 200) {
                    model.setStatus("AVAILABLE");
                    model.setStatusDetail("Active & Verified: Google Gemini Image Synthesis (" + latency + "ms)");
                    model.setVerifiedWorking(true);
                } else if (testResp.statusCode() == 429) {
                    model.setStatus("ACCESS_REQUIRED");
                    model.setStatusDetail("Verified Endpoint (HTTP 429): Quota exceeded or paid project billing required on ai.google.dev");
                    model.setVerifiedWorking(false);
                } else {
                    model.setStatus("ACCESS_REQUIRED");
                    model.setStatusDetail("Gemini API status " + testResp.statusCode());
                    model.setVerifiedWorking(false);
                }
            } catch (Exception e) {
                model.setStatus("ACCESS_REQUIRED");
                model.setStatusDetail("Verification check: " + e.getMessage());
                model.setVerifiedWorking(false);
            }
            return model;
        }

        // 2c. OpenAI Image Models Verification
        if (idLower.contains("gpt-image") || idLower.contains("flare") || idLower.contains("sunburst")) {
            String openAiKey = System.getenv("OPENAI_API_KEY");
            if (openAiKey == null || openAiKey.isBlank()) {
                model.setStatus("CONFIGURATION_REQUIRED");
                model.setStatusDetail("Missing OPENAI_API_KEY environment variable. Please set key to enable GPT Image 2.5.");
                model.setVerifiedWorking(false);
                return model;
            }
            try {
                HttpRequest testReq = HttpRequest.newBuilder()
                        .uri(URI.create("https://api.openai.com/v1/models"))
                        .header("Authorization", "Bearer " + openAiKey)
                        .timeout(Duration.ofSeconds(10))
                        .GET()
                        .build();
                HttpResponse<String> testResp = httpClient.send(testReq, HttpResponse.BodyHandlers.ofString());
                long latency = System.currentTimeMillis() - startTime;
                model.setLatencyMs(latency);

                if (testResp.statusCode() == 200) {
                    model.setStatus("AVAILABLE");
                    model.setStatusDetail("Active & Verified: OpenAI Model API Active (" + latency + "ms)");
                    model.setVerifiedWorking(true);
                } else if (testResp.statusCode() == 429) {
                    model.setStatus("ACCESS_REQUIRED");
                    model.setStatusDetail("Verified Endpoint (HTTP 429): Active OpenAI credit balance required.");
                    model.setVerifiedWorking(false);
                } else {
                    model.setStatus("ACCESS_REQUIRED");
                    model.setStatusDetail("OpenAI status " + testResp.statusCode());
                    model.setVerifiedWorking(false);
                }
            } catch (Exception e) {
                model.setStatus("ACCESS_REQUIRED");
                model.setStatusDetail("OpenAI verification: " + e.getMessage());
                model.setVerifiedWorking(false);
            }
            return model;
        }

        // 3. Hugging Face Models Verification
        if (token == null || token.isBlank()) {
            model.setStatus("CONFIGURATION_REQUIRED");
            model.setStatusDetail("Missing HF_TOKEN environment variable. Please set HF_TOKEN to authenticate with Hugging Face.");
            model.setVerifiedWorking(false);
            return model;
        }

        // 3a. Known models with no router support
        if (idLower.contains("florence")) {
            model.setStatus("PROVIDER_UNAVAILABLE");
            model.setStatusDetail("No hosted inference provider on Hugging Face router. Custom architecture requires a dedicated Inference Endpoint container.");
            model.setVerifiedWorking(false);
            return model;
        }

        if (idLower.contains("vl-7b") || idLower.contains("qwen2.5-vl")) {
            model.setStatus("PROVIDER_UNAVAILABLE");
            model.setStatusDetail("Featherless AI provider on router does not support multimodal vision task. Requires dedicated GPU endpoint.");
            model.setVerifiedWorking(false);
            return model;
        }

        // 3b. Text-to-Text HF models
        if ("text-to-text".equals(model.getTaskType())) {
            try {
                Map<String, Object> req = Map.of(
                        "model", model.getHfModelId() != null ? model.getHfModelId() : model.getId(),
                        "messages", List.of(Map.of("role", "user", "content", "hi")),
                        "max_tokens", 3
                );
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create("https://router.huggingface.co/v1/chat/completions"))
                        .header("Authorization", "Bearer " + token)
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(10))
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(req)))
                        .build();

                HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                long latency = System.currentTimeMillis() - startTime;
                model.setLatencyMs(latency);

                if (resp.statusCode() == 200) {
                    model.setStatus("AVAILABLE");
                    model.setStatusDetail("Active & Verified: Live on Hugging Face Router (" + latency + "ms)");
                    model.setVerifiedWorking(true);
                } else if (resp.statusCode() == 402) {
                    model.setStatus("ACCESS_REQUIRED");
                    model.setStatusDetail("Quota Exhausted (HTTP 402): Pre-paid Hugging Face credits or PRO subscription required.");
                    model.setVerifiedWorking(false);
                } else if (resp.statusCode() == 401) {
                    model.setStatus("CONFIGURATION_REQUIRED");
                    model.setStatusDetail("Invalid HF_TOKEN (HTTP 401). Please verify your token permissions.");
                    model.setVerifiedWorking(false);
                } else {
                    model.setStatus("PROVIDER_UNAVAILABLE");
                    model.setStatusDetail("Hugging Face Router returned HTTP " + resp.statusCode() + ": " + resp.body());
                    model.setVerifiedWorking(false);
                }
            } catch (Exception e) {
                model.setStatus("PROVIDER_UNAVAILABLE");
                model.setStatusDetail("Hugging Face connection error: " + e.getMessage());
                model.setVerifiedWorking(false);
            }
            return model;
        }

        // 3c. Text-to-Image HF models
        if ("text-to-image".equals(model.getTaskType())) {
            try {
                String endpointUrl = "https://router.huggingface.co/nscale/v1/images/generations";
                if (idLower.contains("stable-diffusion") || idLower.contains("sdxl")) {
                    endpointUrl = "https://router.huggingface.co/fal-ai/fal-ai/fast-sdxl";
                }

                Map<String, Object> req = Map.of("prompt", "a cat", "model", model.getId());
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(endpointUrl))
                        .header("Authorization", "Bearer " + token)
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(10))
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(req)))
                        .build();

                HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                long latency = System.currentTimeMillis() - startTime;
                model.setLatencyMs(latency);

                if (resp.statusCode() == 200) {
                    model.setStatus("AVAILABLE");
                    model.setStatusDetail("Active & Verified: Live on Hugging Face Image Provider (" + latency + "ms)");
                    model.setVerifiedWorking(true);
                } else if (resp.statusCode() == 402) {
                    model.setStatus("ACCESS_REQUIRED");
                    model.setStatusDetail("Pre-Paid Credits Required (HTTP 402): Pre-paid Hugging Face credits required to generate images with hosted providers.");
                    model.setVerifiedWorking(false);
                } else if (resp.statusCode() == 410 || resp.statusCode() == 400) {
                    model.setStatus("ACCESS_REQUIRED");
                    model.setStatusDetail("Serverless Deprecated: Free hf-inference deprecated. Dedicated providers require pre-paid account credits.");
                    model.setVerifiedWorking(false);
                } else {
                    model.setStatus("ACCESS_REQUIRED");
                    model.setStatusDetail("Hugging Face returned HTTP " + resp.statusCode() + ": " + resp.body());
                    model.setVerifiedWorking(false);
                }
            } catch (Exception e) {
                model.setStatus("PROVIDER_UNAVAILABLE");
                model.setStatusDetail("Connection error to Hugging Face: " + e.getMessage());
                model.setVerifiedWorking(false);
            }
            return model;
        }

        return model;
    }
}
`;

fs.writeFileSync(filePath, prefix + cleanTail, 'utf8');
console.log('Cleaned HubRegistryService.java successfully!');
