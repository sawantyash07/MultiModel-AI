import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  ArrowUp,
  Square,
  Paperclip,
  ImageIcon,
  FileText,
  Table as TableIcon,
  X,
  Check,
  UploadCloud,
  Globe,
  Mic,
  Highlighter,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { findLanguageByCode } from '../services/languageRegistry';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileCategory(name = '', type = '') {
  const lowerName = name.toLowerCase();
  const lowerType = type.toLowerCase();

  if (lowerName.endsWith('.pdf') || lowerType.includes('pdf')) {
    return { label: 'PDF', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.12)', icon: 'pdf' };
  }
  if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc') || lowerType.includes('word')) {
    return { label: 'DOCX', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.12)', icon: 'doc' };
  }
  if (
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.csv') ||
    lowerType.includes('spreadsheet') ||
    lowerType.includes('excel') ||
    lowerType.includes('csv')
  ) {
    return {
      label: lowerName.endsWith('.csv') ? 'CSV' : 'SHEET',
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.12)',
      icon: 'sheet'
    };
  }
  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerType.includes('text/plain')) {
    return { label: 'TEXT', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.12)', icon: 'text' };
  }
  return { label: 'FILE', color: '#10a37f', bgColor: 'rgba(16, 163, 127, 0.12)', icon: 'file' };
}

const MessageComposer = forwardRef(function MessageComposer(
  {
    onSendMessage,
    onStopGeneration,
    isGenerating = false,
    selectedModelId = 'gemini-2.5-flash',
    selectedLanguage = 'en',
    conversationId = null,
    disabled = false,
    isHighlightMode = false,
    onToggleHighlightMode = null,
    activeHighlightColorObj = null,
    presetPrompt = null,
    presetAttachment = null
  },
  ref
) {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [composerError, setComposerError] = useState(null);
  const [webSearchActive, setWebSearchActive] = useState(false);
  const [imageGenActive, setImageGenActive] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Speech-to-Text Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Expose imperative methods to parent (ChatArea)
  useImperativeHandle(ref, () => ({
    openFilePicker: () => {
      fileInputRef.current?.click();
    },
    focus: () => {
      textareaRef.current?.focus();
    },
    setPromptText: (text) => {
      setPrompt(text);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 50);
    },
    setImageGenActive: (active) => {
      setImageGenActive(active);
    },
    setWebSearchActive: (active) => {
      setWebSearchActive(active);
    }
  }));

  // Handle external preset prompt population from dynamic suggestion chips or cards
  useEffect(() => {
    if (presetPrompt !== null && presetPrompt !== undefined && presetPrompt !== '') {
      setPrompt(presetPrompt);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 60);
    }
  }, [presetPrompt]);

  useEffect(() => {
    if (presetAttachment) {
      setAttachments([presetAttachment]);
      setImageGenActive(true);
    }
  }, [presetAttachment]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 180) + 'px';
    }
  }, [prompt]);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!prompt.trim() && attachments.length === 0) || isGenerating || disabled) return;
    setComposerError(null);
    let finalPrompt = prompt.trim();
    if (imageGenActive && !finalPrompt.toLowerCase().startsWith('generate image:') && !finalPrompt.toLowerCase().startsWith('/image')) {
      finalPrompt = `Generate image: ${finalPrompt}`;
    }
    onSendMessage(finalPrompt, attachments, { webSearch: webSearchActive, imageGen: imageGenActive });
    setPrompt('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Clipboard Paste handler (for pasting screenshots, images, files)
  const handlePaste = (e) => {
    if (disabled || isGenerating) return;
    if (e.clipboardData && e.clipboardData.items) {
      const items = e.clipboardData.items;
      const filesToProcess = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) filesToProcess.push(file);
        }
      }
      if (filesToProcess.length > 0) {
        validateAndAddFiles(filesToProcess);
      }
    }
  };

  const validateAndAddFiles = (files) => {
    if (!files || !files.length) return;
    setComposerError(null);

    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        setComposerError(`"${file.name}" (${formatBytes(file.size)}) exceeds maximum limit of 50MB.`);
        return;
      }

      const fileName = file.name || 'file';
      const isImg =
        file.type?.startsWith('image/') ||
        fileName.toLowerCase().endsWith('.jpg') ||
        fileName.toLowerCase().endsWith('.jpeg') ||
        fileName.toLowerCase().endsWith('.png') ||
        fileName.toLowerCase().endsWith('.webp');
      const isDoc =
        fileName.toLowerCase().endsWith('.pdf') ||
        fileName.toLowerCase().endsWith('.docx') ||
        fileName.toLowerCase().endsWith('.doc') ||
        fileName.toLowerCase().endsWith('.xlsx') ||
        fileName.toLowerCase().endsWith('.xls') ||
        fileName.toLowerCase().endsWith('.csv') ||
        fileName.toLowerCase().endsWith('.txt') ||
        fileName.toLowerCase().endsWith('.md') ||
        file.type?.includes('pdf') ||
        file.type?.includes('word') ||
        file.type?.includes('spreadsheet') ||
        file.type?.includes('excel') ||
        file.type?.includes('csv') ||
        file.type?.includes('text/plain');

      if (!isImg && !isDoc) {
        setComposerError(
          `Unsupported file: "${fileName}". Supported: Images (JPG, PNG, WebP) and Documents (PDF, DOCX, XLSX, CSV, TXT, MD).`
        );
        return;
      }

      const tempId = 'att-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const isDocumentFile = !isImg;
      const category = getFileCategory(fileName, file.type);

      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target.result;

        let serverDocInfo = null;
        if (isDocumentFile) {
          try {
            serverDocInfo = await api.uploadDocument(file, conversationId);
          } catch (err) {
            console.warn('[Upload] Backend indexing skipped or failed:', err);
          }
        }

        const newAttachment = {
          id: tempId,
          name: fileName,
          size: file.size,
          formattedSize: formatBytes(file.size),
          type: file.type || (isImg ? 'image/jpeg' : 'application/octet-stream'),
          dataUrl,
          isDocument: isDocumentFile,
          category,
          pageCount: serverDocInfo?.pageCount || null,
          chunkCount: serverDocInfo?.chunkCount || null
        };

        setAttachments((prev) => [...prev, newAttachment]);
      };

      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  // Speech-to-Text Recording Logic (Whisper Large v3)
  const handleStartRecording = async () => {
    if (isRecording || isGenerating || disabled) return;
    setComposerError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 0) {
          await transcribeAudio(audioBlob);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setComposerError('Microphone access was denied. Please allow audio recording in your browser.');
    }
  };

  const handleStopRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleCancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.onstop = () => {
          if (mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
          }
        };
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const transcribeAudio = async (blob) => {
    setIsTranscribing(true);
    try {
      const result = await api.transcribeAudio(blob, selectedLanguage);
      if (result && result.text) {
        setPrompt((prev) => (prev ? prev + ' ' + result.text.trim() : result.text.trim()));
      }
    } catch (err) {
      console.error('Speech transcription failed:', err);
      setComposerError('Audio transcription failed. Please try speaking again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const canSend = (prompt.trim().length > 0 || attachments.length > 0) && !isGenerating && !disabled;

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '840px',
        mx: 'auto',
        px: { xs: 1.5, sm: 2.5 },
        pb: { xs: 1.5, sm: 2 },
        pt: 0,
        position: 'relative',
        zIndex: 10
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: { xs: 12, sm: 20 },
            right: { xs: 12, sm: 20 },
            bottom: { xs: 12, sm: 16 },
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '2px dashed #10b981',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30,
            pointerEvents: 'none'
          }}
        >
          <UploadCloud size={30} color="#10b981" />
          <Typography variant="body2" sx={{ fontWeight: 650, color: 'primary.main', mt: 1 }}>
            Drop documents or images to attach
          </Typography>
        </Box>
      )}

      {/* Error Banner */}
      {composerError && (
        <Alert
          severity="error"
          onClose={() => setComposerError(null)}
          sx={{ mb: 1, borderRadius: 2, fontSize: '0.8rem', py: 0.2 }}
        >
          {composerError}
        </Alert>
      )}

      {/* Main Composer Box */}
      <Box
        sx={{
          borderRadius: '18px',
          border: '1px solid',
          borderColor: isFocused ? 'primary.main' : 'background.composerBorder',
          backgroundColor: 'background.composer',
          boxShadow: isFocused
            ? '0 0 0 3px rgba(16, 185, 129, 0.14), 0 4px 16px rgba(0,0,0,0.04)'
            : '0 2px 10px rgba(0,0,0,0.03)',
          transition: 'all 0.18s ease-in-out',
          p: 1.2,
          px: 1.5
        }}
      >
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1, pt: 0.2 }}>
            {attachments.map((att, idx) => {
              const cat = att.category || getFileCategory(att.name, att.type);
              const isImage = att.dataUrl?.startsWith('data:image');

              return (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 0.6,
                    pr: 1,
                    borderRadius: '9px',
                    backgroundColor: 'background.card',
                    border: '1px solid',
                    borderColor: 'divider',
                    maxWidth: 240
                  }}
                >
                  {isImage ? (
                    <Box
                      component="img"
                      src={att.dataUrl}
                      alt={att.name}
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '6px',
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '6px',
                        backgroundColor: cat.bgColor,
                        color: cat.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {cat.icon === 'sheet' ? <TableIcon size={15} /> : <FileText size={15} />}
                    </Box>
                  )}

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ fontWeight: 650, fontSize: '0.78rem', display: 'block' }}
                    >
                      {att.name}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.675rem', color: 'text.secondary' }}>
                      {att.formattedSize}
                    </Typography>
                  </Box>

                  <IconButton
                    size="small"
                    onClick={() => handleRemoveAttachment(idx)}
                    sx={{ p: 0.3, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                  >
                    <X size={13} />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Live Voice Recording Status */}
        {isRecording && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '10px',
              p: 0.8,
              px: 1.4,
              mb: 1
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.3)',
                  animation: 'pulseGlow 1.2s infinite'
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 650, color: '#ef4444', fontSize: '0.81rem' }}>
                Recording ({formatSeconds(recordingSeconds)})
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'inline' } }}>
                Speak in {findLanguageByCode(selectedLanguage).nativeLabel}...
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <Tooltip title="Cancel recording">
                <IconButton size="small" onClick={handleCancelRecording} sx={{ color: 'text.secondary', p: 0.4 }}>
                  <X size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Transcribe speech">
                <IconButton
                  size="small"
                  onClick={handleStopRecording}
                  sx={{
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    p: 0.45,
                    '&:hover': { backgroundColor: '#dc2626' }
                  }}
                >
                  <Check size={14} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}

        {/* Transcribing Indicator */}
        {isTranscribing && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4, px: 0.5, mb: 0.5 }}>
            <CircularProgress size={13} color="primary" />
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 650 }}>
              Transcribing speech with Whisper...
            </Typography>
          </Box>
        )}

        {/* Input Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={
            webSearchActive
              ? 'Ask a question with live verified web citations...'
              : attachments.some((a) => a.isDocument)
              ? 'Ask anything about the attached document(s)...'
              : imageGenActive
              ? 'Describe the image you want FLUX to create...'
              : 'Message Yash AI... (Shift+Enter for newline, paste screenshots directly)'
          }
          disabled={disabled || isRecording}
          style={{
            width: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'inherit',
            fontFamily: 'inherit',
            fontSize: '0.94rem',
            lineHeight: 1.55,
            padding: '4px 2px',
            maxHeight: '180px',
            display: 'block'
          }}
        />

        {/* Bottom Actions Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5, pt: 0.4 }}>
          {/* Left Action Controls (Attachment, Web Search, Image Gen, Microphone, Highlighter) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,.csv,text/csv,.txt,text/plain,.md"
              multiple
            />

            <Tooltip title="Attach documents or images (PDF, DOCX, XLSX, CSV, TXT, Images)">
              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating || disabled || isRecording}
                sx={{
                  color: attachments.length > 0 ? 'primary.main' : 'text.secondary',
                  p: 0.65,
                  borderRadius: '8px',
                  '&:hover': { color: 'text.primary', backgroundColor: 'background.hover' }
                }}
              >
                <Paperclip size={17} />
              </IconButton>
            </Tooltip>

            <Tooltip title={webSearchActive ? 'Web Search: ON (click to disable)' : 'Web Search: AUTO (click to force live search)'}>
              <IconButton
                size="small"
                onClick={() => setWebSearchActive((prev) => !prev)}
                disabled={isGenerating || disabled || isRecording}
                sx={{
                  color: webSearchActive ? '#10b981' : 'text.secondary',
                  backgroundColor: webSearchActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  p: 0.65,
                  borderRadius: '8px',
                  '&:hover': {
                    color: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.18)'
                  }
                }}
              >
                <Globe size={17} />
              </IconButton>
            </Tooltip>

            <Tooltip title={imageGenActive ? 'Image Generation Mode: ON (FLUX)' : 'Image Generation Mode (FLUX)'}>
              <IconButton
                size="small"
                onClick={() => setImageGenActive((prev) => !prev)}
                disabled={isGenerating || disabled || isRecording}
                sx={{
                  color: imageGenActive ? '#ec4899' : 'text.secondary',
                  backgroundColor: imageGenActive ? 'rgba(236, 72, 153, 0.14)' : 'transparent',
                  p: 0.65,
                  borderRadius: '8px',
                  '&:hover': {
                    color: '#ec4899',
                    backgroundColor: 'rgba(236, 72, 153, 0.2)'
                  }
                }}
              >
                <Sparkles size={17} />
              </IconButton>
            </Tooltip>

            <Tooltip title={isRecording ? 'Stop recording' : `Voice Input (${findLanguageByCode(selectedLanguage).nativeLabel})`}>
              <IconButton
                size="small"
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={isGenerating || disabled || isTranscribing}
                sx={{
                  color: isRecording ? '#ffffff' : 'text.secondary',
                  backgroundColor: isRecording ? '#ef4444' : 'transparent',
                  p: 0.65,
                  borderRadius: '8px',
                  '&:hover': {
                    color: isRecording ? '#ffffff' : 'text.primary',
                    backgroundColor: isRecording ? '#dc2626' : 'background.hover'
                  }
                }}
              >
                {isRecording ? <Square size={13} fill="#ffffff" /> : <Mic size={17} />}
              </IconButton>
            </Tooltip>

            {onToggleHighlightMode && (
              <Tooltip
                title={
                  isHighlightMode
                    ? `Text Highlighter is ON (${activeHighlightColorObj?.label || 'Active'}). Click to turn OFF.`
                    : 'Turn on Text Highlighter (Red, Green, Blue marker)'
                }
              >
                <IconButton
                  size="small"
                  onClick={onToggleHighlightMode}
                  disabled={isGenerating || disabled || isRecording}
                  sx={{
                    color: isHighlightMode ? activeHighlightColorObj?.swatchColor || '#10b981' : 'text.secondary',
                    backgroundColor: isHighlightMode ? activeHighlightColorObj?.badgeBg || 'rgba(16, 185, 129, 0.12)' : 'transparent',
                    p: 0.65,
                    borderRadius: '8px',
                    '&:hover': {
                      backgroundColor: isHighlightMode ? activeHighlightColorObj?.badgeBg : 'background.hover'
                    }
                  }}
                >
                  <Highlighter size={17} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Right Action: Send / Stop Button */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isGenerating ? (
              <Tooltip title="Stop generation">
                <IconButton
                  size="small"
                  onClick={onStopGeneration}
                  sx={{
                    backgroundColor: '#1f2937',
                    color: '#ffffff',
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    '&:hover': { backgroundColor: '#374151' }
                  }}
                >
                  <Square size={13} fill="#ffffff" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Send message (Enter)">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleSend}
                    disabled={!canSend}
                    sx={{
                      backgroundColor: canSend ? '#10b981' : 'background.hover',
                      color: canSend ? '#ffffff' : 'text.disabled',
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        backgroundColor: canSend ? '#059669' : 'background.hover'
                      }
                    }}
                  >
                    <ArrowUp size={16} strokeWidth={2.6} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>

      {/* Subtle Status Badges and Disclaimer Below Composer */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.2, mt: 0.8, flexWrap: 'wrap' }}>
        {webSearchActive && (
          <Chip
            size="small"
            label="Live Web Research ON"
            onDelete={() => setWebSearchActive(false)}
            sx={{
              height: 18,
              fontSize: '0.64rem',
              fontWeight: 650,
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              borderRadius: '6px'
            }}
          />
        )}
        {imageGenActive && (
          <Chip
            size="small"
            label="Image Gen Mode ON (FLUX)"
            onDelete={() => setImageGenActive(false)}
            sx={{
              height: 18,
              fontSize: '0.64rem',
              fontWeight: 650,
              backgroundColor: 'rgba(236, 72, 153, 0.12)',
              color: '#ec4899',
              borderRadius: '6px'
            }}
          />
        )}
        <Typography
          variant="caption"
          sx={{
            textAlign: 'center',
            color: 'text.disabled',
            fontSize: '0.71rem'
          }}
        >
          Yash AI can make mistakes. Verify important information.
        </Typography>
      </Box>
    </Box>
  );
});

export default MessageComposer;
