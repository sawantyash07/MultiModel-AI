import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Button,
  IconButton,
  Chip,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  UploadCloud,
  FileImage,
  Eye,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Zap,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from '../CodeBlock';
import { api } from '../../services/api';

export default function ImageToTextPlayground({
  models = [],
  selectedModelId,
  onSelectModel,
  onShowToast
}) {
  const [currentModelId, setCurrentModelId] = useState(selectedModelId || 'gemini-2.5-flash-vision');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [prompt, setPrompt] = useState('Describe this image in detail and identify key subjects, text, colors, and layout.');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  const selectedModel = models.find(m => m.id === currentModelId) || models[0] || {};

  const handleFileChange = (file) => {
    if (!file) return;

    // Validate size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 20MB.`);
      return;
    }

    // Validate MIME type
    const validMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setErrorMsg(`Unsupported file type: '${file.type}'. Please upload a PNG, JPEG, WEBP, or GIF image.`);
      return;
    }

    setErrorMsg(null);
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || isAnalyzing) return;
    setIsAnalyzing(true);
    setErrorMsg(null);

    const effectivePrompt = prompt && prompt.trim()
      ? prompt.trim()
      : 'Describe this image in detail and identify key subjects, text, colors, and layout.';

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('prompt', effectivePrompt);
    formData.append('modelId', currentModelId);

    try {
      const resp = await api.analyzeHubVisionMultipart(formData);
      if (resp.status === 'ERROR') {
        setErrorMsg(resp.error || 'Vision analysis failed');
        if (onShowToast) onShowToast(resp.error || 'Analysis failed', 'error');
      } else {
        setResult(resp);
        if (onShowToast) onShowToast('Image analyzed successfully!', 'success');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Vision analysis request failed');
      if (onShowToast) onShowToast(err.message || 'Request failed', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyResult = () => {
    if (result && result.description) {
      navigator.clipboard.writeText(result.description);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const promptPresets = [
    'Describe this image in detail and identify key subjects, text, colors, and layout.',
    'Extract all readable text, signs, logos, and labels in this image (OCR).',
    'Identify all distinct objects and their relative spatial locations in this image.',
    'Explain the diagram, chart, or data visualization present in this image.'
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2.5, overflowY: 'auto', pr: 0.5 }}>
      {/* Model Selector Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 280 }}>
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel id="hub-i2t-model-label">Select Vision Model</InputLabel>
            <Select
              labelId="hub-i2t-model-label"
              value={currentModelId}
              label="Select Vision Model"
              onChange={(e) => {
                setCurrentModelId(e.target.value);
                if (onSelectModel) onSelectModel(e.target.value);
              }}
              sx={{ borderRadius: 2 }}
            >
              {models.map(m => (
                <MenuItem key={m.id} value={m.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {m.name}
                    </Typography>
                    <Chip
                      label={m.status === 'AVAILABLE' ? 'Available' : 'Unavailable'}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        backgroundColor: m.status === 'AVAILABLE' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: m.status === 'AVAILABLE' ? '#22c55e' : '#ef4444'
                      }}
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedModel.provider && (
            <Chip
              label={selectedModel.provider}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
            />
          )}
        </Box>

        {result && result.durationMs && (
          <Chip
            icon={<Zap size={13} />}
            label={`${result.durationMs}ms`}
            size="small"
            sx={{ backgroundColor: 'action.hover', fontWeight: 600, fontSize: '0.725rem' }}
          />
        )}
      </Paper>

      {/* Error Alert */}
      {errorMsg && (
        <Alert
          severity="warning"
          icon={<AlertTriangle size={18} />}
          sx={{ borderRadius: 2.5 }}
          action={
            currentModelId !== 'gemini-2.5-flash-vision' ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setCurrentModelId('gemini-2.5-flash-vision');
                  if (onSelectModel) onSelectModel('gemini-2.5-flash-vision');
                  setErrorMsg(null);
                }}
              >
                Switch to Gemini Vision (Verified)
              </Button>
            ) : null
          }
        >
          {errorMsg}
        </Alert>
      )}

      {/* Upload Zone & Image Preview */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Upload or Drop Image
        </Typography>

        {!previewUrl ? (
          <Box
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: '2px dashed',
              borderColor: isDragging ? 'primary.main' : 'divider',
              backgroundColor: isDragging ? 'action.hover' : 'background.default',
              borderRadius: 3,
              p: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              gap: 1.5,
              '&:hover': {
                borderColor: 'primary.light',
                backgroundColor: 'action.hover'
              }
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                backgroundColor: 'action.selected',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.main'
              }}
            >
              <UploadCloud size={28} />
            </Box>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                Click to browse or drag and drop an image
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                PNG, JPEG, WEBP, or GIF up to 20MB
              </Typography>
            </Box>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(e.target.files[0])}
            />
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2.5,
              p: 2,
              borderRadius: 2.5,
              backgroundColor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              flexWrap: 'wrap'
            }}
          >
            <Box
              sx={{
                width: 140,
                height: 140,
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
                backgroundColor: '#000000'
              }}
            >
              <img
                src={previewUrl}
                alt="Preview"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>

            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {selectedFile?.name || 'Attached Image'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.3 }}>
                Type: {selectedFile?.type} | Size: {(selectedFile?.size / 1024).toFixed(1)} KB
              </Typography>

              <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<Trash2 size={13} />}
                  onClick={handleRemoveImage}
                  sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem' }}
                >
                  Remove Image
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem' }}
                >
                  Change Image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(e.target.files[0])}
                />
              </Box>
            </Box>
          </Box>
        )}

        {/* Task Prompt & Presets */}
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
            Question or Analysis Prompt
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isAnalyzing}
            sx={{ borderRadius: 2 }}
          />
        </Box>

        {/* Preset Prompt Chips */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {promptPresets.map((pr, idx) => (
            <Chip
              key={idx}
              icon={<Sparkles size={12} />}
              label={pr}
              size="small"
              onClick={() => setPrompt(pr)}
              sx={{
                backgroundColor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                fontSize: '0.725rem',
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'action.hover' }
              }}
            />
          ))}
        </Box>

        {/* Analyze Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 0.5 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleAnalyze}
            disabled={!selectedFile || isAnalyzing}
            startIcon={isAnalyzing ? <CircularProgress size={18} color="inherit" /> : <Eye size={18} />}
            sx={{
              borderRadius: 2.5,
              px: 4,
              py: 1.1,
              fontWeight: 700,
              fontSize: '0.95rem',
              textTransform: 'none'
            }}
          >
            {isAnalyzing ? 'Analyzing Image...' : 'Analyze Image'}
          </Button>
        </Box>
      </Paper>

      {/* Analysis Result Card */}
      {result && result.description && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.8
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Vision Intelligence Output
              </Typography>
              <Chip
                label={result.modelName || result.modelId}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600, fontSize: '0.725rem' }}
              />
            </Box>

            <Tooltip title={copied ? 'Copied to clipboard!' : 'Copy Analysis'}>
              <Button
                size="small"
                variant="outlined"
                startIcon={copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                onClick={handleCopyResult}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </Tooltip>
          </Box>

          <Divider />

          {/* Rendered Markdown Output */}
          <Box sx={{ fontSize: '0.925rem', lineHeight: 1.65 }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
                  ) : (
                    <code
                      style={{
                        backgroundColor: 'rgba(125, 125, 125, 0.15)',
                        padding: '2px 5px',
                        borderRadius: 4,
                        fontFamily: 'monospace',
                        fontSize: '0.85em'
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
              }}
            >
              {result.description}
            </ReactMarkdown>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
