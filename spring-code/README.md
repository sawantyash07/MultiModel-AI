# 👁️ Multimodal AI Chatbot Application (Spring Boot & Spring AI)

A modern, production-grade **Multimodal AI Chatbot Application** built with **Spring Boot 3 / Spring AI 2** that processes both **text and image inputs**. Users can upload photos, UI screenshots, code error screenshots, or ask natural language questions, maintaining multi-turn conversation context across sessions with a sidebar history manager.

---

## 🧠 Multimodal AI Architecture & Core Concepts

### 1. Image Pixel Representation & Preprocessing
Images are fundamentally represented as 3D numerical tensors of height $H$, width $W$, and 3 color channels $C \in \{R, G, B\}$:
$$\mathbf{I} \in \mathbb{R}^{H \times W \times C}$$
The raw pixel values (ranging from $0$ to $255$) are normalized using mean $\boldsymbol{\mu}$ and standard deviation $\boldsymbol{\sigma}$ vectors across RGB channels:
$$\mathbf{I}_{\text{norm}} = \frac{\mathbf{I} - \boldsymbol{\mu}}{\boldsymbol{\sigma}}$$

### 2. Patch Splitting & Flattening
Rather than feeding raw 2D pixel grids directly into a transformer, vision architectures divide normalized images into non-overlapping spatial patches of size $(P \times P)$ pixels (typically $16 \times 16$ or $14 \times 14$).

The total number of patches $N$ is calculated as:
$$N = \left(\frac{H}{P}\right) \times \left(\frac{W}{P}\right)$$
Each 2D patch is flattened into a 1D vector $\mathbf{x}_p \in \mathbb{R}^{P^2 \cdot C}$ (e.g., $16 \times 16 \times 3 = 768$ dimensions).

### 3. Linear Projection & Positional Embeddings
Each patch vector $\mathbf{x}_p$ is linearly projected onto a $D_{\text{vision}}$-dimensional embedding space using a learnable projection matrix $\mathbf{E}$:
$$\mathbf{z}_0 = \left[\mathbf{x}_p^1 \mathbf{E}; \mathbf{x}_p^2 \mathbf{E}; \dots; \mathbf{x}_p^N \mathbf{E}\right] + \mathbf{E}_{\text{pos}}$$
Spatial position embeddings $\mathbf{E}_{\text{pos}}$ are added to preserve 2D grid coordinates across rows and columns.

### 4. Vision Encoder (ViT / CLIP-Vision)
The sequence of patch token embeddings passes through $L$ layers of Multi-Head Self-Attention (MHSA) and Layer Normalization (LN). The Vision Encoder extracts high-level spatial visual feature embeddings $\mathbf{V}_{\text{vis}} \in \mathbb{R}^{N \times D_{\text{vision}}}$.

### 5. Projection / Adapter Layer (Modality Alignment)
Because the Vision Encoder output dimension $D_{\text{vision}}$ differs from the LLM text token dimension $D_{\text{LLM}}$, a **Projection / Adapter Layer** (e.g., MLP, Linear Layer, or Cross-Attention Perceiver) projects visual embeddings directly into text token latent space:
$$\mathbf{E}_{\text{visual}} = \mathbf{W}_{\text{proj}} \mathbf{V}_{\text{vis}} + \mathbf{b}_{\text{proj}} \quad \in \mathbb{R}^{N \times D_{\text{LLM}}}$$

### 6. Multimodal LLM Autoregressive Generation
The projected visual tokens $\mathbf{E}_{\text{visual}}$ are prepended or interleaved with text prompt tokens $\mathbf{E}_{\text{text}}$ inside a unified sequence:
$$\mathbf{Z}_{\text{input}} = [\mathbf{E}_{\text{visual}}, \mathbf{E}_{\text{text}}]$$
The multimodal LLM applies standard cross-attention and self-attention over $\mathbf{Z}_{\text{input}}$ to generate contextual answers.

---

## 🏗️ Project Architecture

The application follows a clean 4-tier architecture:

```
src/main/java/com/coderarmy/ragsupport/
├── controller/
│   └── MultimodalChatController.java     # REST Endpoints for chat, multipart uploads, session management
├── service/
│   ├── MultimodalAiService.java          # Spring AI ChatModel integration & vision fallback engine
│   ├── ChatSessionService.java           # Manual memory & conversation session manager
│   └── MultimodalConceptService.java     # Architectural theory data provider
├── model/
│   ├── ChatMessage.java                  # Message entity (text, image base64, role, timestamp)
│   ├── ChatSession.java                  # Session history entity
│   ├── MultimodalChatRequest.java        # JSON DTO payload
│   ├── MultimodalChatResponse.java       # API output response DTO
│   └── MultimodalConceptExplanation.java # Concept breakdown DTO
└── RagSupportApplication.java           # Spring Boot Entry Point
```

---

## 🚀 Key Features

1. **Multimodal Input Support**: Accepts both text-only prompts and image uploads (`PNG`, `JPEG`, `JPG`, `WEBP`) via `multipart/form-data` or Base64 JSON payloads.
2. **Spring AI Integration**: Uses Spring AI `ChatModel`, `UserMessage`, `AssistantMessage`, `Media`, and `Prompt` API.
3. **Manual History Context Management**: Maintains multi-turn context across conversations by storing session history and prepending prior message pairs into model prompts.
4. **Recent Chat History Sidebar**: Left sidebar displaying active sessions, message counts, active selection, and quick session deletion.
5. **Modern Responsive UI**: Built-in glassmorphism frontend served at `http://localhost:8080` with image upload previews, lightbox zooming, markdown rendering, code block syntax formatting, and preset prompts.
6. **Resilient Vision Analyzer Fallback**: Works out-of-the-box even without external API keys for local testing, demoing object recognition, screenshot bug identification, and UI layout analysis.

---

## 🛠️ How to Run the Application

### Prerequisites
- **Java 21** or higher
- **Maven 3.8+**

### Step 1: Clone & Build
Navigate to the `spring-code` directory and compile:
```bash
mvn clean package -DskipTests=false
```

### Step 2: Configure Environment (Optional)
To use a live Gemini or OpenAI Vision LLM model, set your API key in `application.properties` or set environment variables:
```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

*(Note: If no API key is set, the built-in Multimodal Vision Analyzer automatically handles all image & text queries smoothly!)*

### Step 3: Launch Application
Run the Spring Boot application:
```bash
mvn spring-boot:run
```
The application starts at: **`http://localhost:8080`**

---

## 🧪 API Endpoints & Postman Testing Guide

### 1. Send Multimodal Chat (`multipart/form-data`)
- **Endpoint**: `POST /api/v1/chat/multimodal`
- **Content-Type**: `multipart/form-data`
- **Body Parameters**:
  - `prompt` (text): `"Identify errors in this code screenshot"`
  - `file` (file): Select image (`code_error.png`)
  - `sessionId` (text, optional): `"session-uuid-123"`

#### Example cURL Command:
```bash
curl -X POST http://localhost:8080/api/v1/chat/multimodal \
  -F "prompt=Analyze this screenshot and point out any errors" \
  -F "file=@screenshot.png" \
  -F "sessionId=my-test-session"
```

---

### 2. Send JSON Multimodal Query (`application/json`)
- **Endpoint**: `POST /api/v1/chat`
- **Content-Type**: `application/json`
- **Body**:
```json
{
  "sessionId": "sess-101",
  "prompt": "Identify the objects in this photo",
  "imageBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "imageName": "photo.png"
}
```

---

### 3. Fetch Sidebar Recent Chat Sessions
- **Endpoint**: `GET /api/v1/chats`
- **Returns**: Array of all active sessions sorted by last updated timestamp.

---

### 4. Fetch Single Session History
- **Endpoint**: `GET /api/v1/chats/{sessionId}`
- **Returns**: Full message array for the specified session.

---

### 5. Create New Chat Session
- **Endpoint**: `POST /api/v1/chats/new`
- **Body**:
```json
{
  "title": "Bug Analysis Session"
}
```

---

### 6. Fetch Multimodal Architecture Concepts
- **Endpoint**: `GET /api/v1/multimodal/concepts`
- **Returns**: Structured mathematical & algorithmic breakdown of RGB pixels, Patch Splitting, ViT Vision Encoders, Adapter Projection Layers, and LLM alignment.
