package com.coderarmy.ragsupport.hub;

import com.coderarmy.ragsupport.hub.controller.ModelHubController;
import com.coderarmy.ragsupport.hub.model.*;
import com.coderarmy.ragsupport.hub.service.HubRegistryService;
import com.coderarmy.ragsupport.hub.service.ImageToTextService;
import com.coderarmy.ragsupport.hub.service.TextToImageService;
import com.coderarmy.ragsupport.hub.service.TextToTextService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

public class ModelHubControllerTest {

    private MockMvc mockMvc;
    private HubRegistryService registryService;
    private TextToTextService textToTextService;
    private TextToImageService textToImageService;
    private ImageToTextService imageToTextService;
    private com.coderarmy.ragsupport.hub.service.PromptUnderstandingService promptUnderstandingService;
    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    public void setUp() {
        registryService = Mockito.mock(HubRegistryService.class);
        textToTextService = Mockito.mock(TextToTextService.class);
        textToImageService = Mockito.mock(TextToImageService.class);
        imageToTextService = Mockito.mock(ImageToTextService.class);
        promptUnderstandingService = Mockito.mock(com.coderarmy.ragsupport.hub.service.PromptUnderstandingService.class);

        ModelHubController controller = new ModelHubController(
                registryService,
                textToTextService,
                textToImageService,
                imageToTextService,
                promptUnderstandingService
        );

        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    public void testGetModels() throws Exception {
        HubModel m1 = new HubModel();
        m1.setId("Qwen/Qwen2.5-7B-Instruct");
        m1.setName("Qwen 2.5 7B Instruct");
        m1.setTaskType("text-to-text");
        m1.setStatus("ACCESS_REQUIRED");

        Mockito.when(registryService.getAllModels(anyString(), anyString())).thenReturn(List.of(m1));

        mockMvc.perform(get("/api/hub/models"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.models[0].id").value("Qwen/Qwen2.5-7B-Instruct"))
                .andExpect(jsonPath("$.models[0].status").value("ACCESS_REQUIRED"));
    }

    @Test
    public void testTextGeneration() throws Exception {
        TextGenerationRequest req = new TextGenerationRequest();
        req.setModelId("gemini-2.5-flash");
        req.setPrompt("Hello world");

        TextGenerationResponse resp = TextGenerationResponse.success(
                "Hello from model!", "gemini-2.5-flash", "Gemini 2.5 Flash", "Google Gemini", 250, 15
        );
        Mockito.when(textToTextService.generateText(any())).thenReturn(resp);

        mockMvc.perform(post("/api/hub/text/generate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value("Hello from model!"))
                .andExpect(jsonPath("$.status").value("SUCCESS"));
    }

    @Test
    public void testImageGeneration() throws Exception {
        ImageGenerationRequest req = new ImageGenerationRequest();
        req.setModelId("flux-schnell-free");
        req.setPrompt("A scenic mountain");

        ImageGenerationResponse resp = ImageGenerationResponse.success(
                "img-123", "flux-schnell-free", "FLUX.1 Schnell", "Pollinations",
                "A scenic mountain", null, "data:image/jpeg;base64,12345", 512, 512, "1:1", "now", 450
        );
        Mockito.when(textToImageService.generateImage(any())).thenReturn(resp);

        mockMvc.perform(post("/api/hub/image/generate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("img-123"))
                .andExpect(jsonPath("$.imageDataUrl").value("data:image/jpeg;base64,12345"));
    }

    @Test
    public void testVisionAnalysis() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "photo.png", "image/png", new byte[]{1, 2, 3, 4}
        );

        ImageAnalysisResponse resp = ImageAnalysisResponse.success(
                "A detailed description of the photo.", "gemini-2.5-flash-vision", "Gemini Vision", "Google Gemini", 300
        );
        Mockito.when(imageToTextService.analyzeMultipart(any(), any(), any())).thenReturn(resp);

        mockMvc.perform(multipart("/api/hub/vision/analyze")
                .file(file)
                .param("prompt", "What is this?")
                .param("modelId", "gemini-2.5-flash-vision"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("A detailed description of the photo."));
    }
}
