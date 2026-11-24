import React, { useState, useRef, useEffect } from 'react';
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
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Send,
  Square,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Bot,
  User,
  Zap,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from '../CodeBlock';
import { api } from '../../services/api';

export default function TextToTextPlayground({
  models = [],
  selectedModelId,
  onSelectModel,
  onShowToast
}) {
  const [currentModelId, setCurrentModelId] = useState(selectedModelId || 'gemini-2.5-flash');
  const [prompt, setPrompt] = useState('');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your AI assistant in the Yash AI Model Hub. Select any model from the dropdown above to test text generation and multi-turn reasoning.',
      createdAt: new Date().toISOString()
    }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastStats, setLastStats] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [streamError, setStreamError] = useState(null);

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (selectedModelId) {
      setCurrentModelId(selectedModelId);
    }
  }, [selectedModelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedModel = models.find(m => m.id === currentModelId) || models[0] || {};

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async () => {
    if (!prompt.trim() || isGenerating) return;

    const userPrompt = prompt.trim();
    setPrompt('');
    setStreamError(null);

    const userMsg = {
      role: 'user',
      content: userPrompt,
      createdAt: new Date().toISOString()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    // Assistant placeholder
    const assistantMsg = {
      role: 'assistant',
      content: '',
      modelId: currentModelId,
      modelName: selectedModel.name || currentModelId,
      provider: selectedModel.provider,
      createdAt: new Date().toISOString()
    };

    setMessages([...newMessages, assistantMsg]);
    setIsGenerating(true);

    abortControllerRef.current = new AbortController();
    let accumulated = '';
    const startTime = Date.now();

    await api.streamHubText({
      modelId: currentModelId,
      prompt: userPrompt,
      messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      systemInstruction,
      signal: abortControllerRef.current.signal,
      onToken: (token) => {
        accumulated += token;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: accumulated }];
          }
          return prev;
        });
      },
      onMetadata: (meta) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, ...meta }];
          }
          return prev;
        });
      },
      onDone: (result) => {
        setIsGenerating(false);
        const duration = Date.now() - startTime;
        setLastStats({ durationMs: duration });
      },
      onError: (err) => {
        setIsGenerating(false);
        setStreamError(err.message || 'Error occurred during generation');
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            if (!last.content) {
              return prev.slice(0, -1); // remove empty assistant message
            }
          }
          return prev;
        });
      }
    });
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
  };

  const handleClear = () => {
    setMessages([]);
    setLastStats(null);
    setStreamError(null);
  };

  const starterPrompts = [
    'Write a production-ready custom React hook for debouncing input queries',
    'Explain how transformers and attention mechanisms work step-by-step',
    'Write a Spring Boot 3 Controller with input validation and OpenAPI docs'
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
      {/* Top Controls: Model Selector & Actions */}
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
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel id="hub-t2t-select-label">Select Text Model</InputLabel>
            <Select
              labelId="hub-t2t-select-label"
              value={currentModelId}
              label="Select Text Model"
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
                      label={m.status === 'AVAILABLE' ? 'Available' : 'Access Required'}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        backgroundColor: m.status === 'AVAILABLE' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                        color: m.status === 'AVAILABLE' ? '#22c55e' : '#eab308'
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {lastStats && (
            <Chip
              icon={<Zap size={13} />}
              label={`${lastStats.durationMs}ms`}
              size="small"
              sx={{ backgroundColor: 'action.hover', fontWeight: 600, fontSize: '0.725rem' }}
            />
          )}

          <Tooltip title="Clear chat history">
            <IconButton size="small" onClick={handleClear} sx={{ color: 'text.secondary' }}>
              <Trash2 size={16} />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Optional System Instruction Accordion */}
      <Accordion
        elevation={0}
        sx={{
          borderRadius: '12px !important',
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary expandIcon={<ChevronDown size={16} />} sx={{ minHeight: 40, px: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            System Instructions (Optional)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.5 }}>
          <TextField
            fullWidth
            multiline
            rows={2}
            size="small"
            placeholder="e.g. You are an expert Java and React engineer. Provide clean, well-commented code."
            value={systemInstruction}
            onChange={(e) => setSystemInstruction(e.target.value)}
            sx={{ fontSize: '0.825rem' }}
          />
        </AccordionDetails>
      </Accordion>

      {/* Stream Error Alert */}
      {streamError && (
        <Alert
          severity="warning"
          icon={<AlertTriangle size={18} />}
          sx={{ borderRadius: 2 }}
          action={
            currentModelId !== 'gemini-2.5-flash' ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setCurrentModelId('gemini-2.5-flash');
                  if (onSelectModel) onSelectModel('gemini-2.5-flash');
                  setStreamError(null);
                }}
              >
                Switch to Gemini (Free)
              </Button>
            ) : null
          }
        >
          {streamError}
        </Alert>
      )}

      {/* Messages Scroll Area */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2.5,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        {messages.map((msg, idx) => (
          <Box
            key={idx}
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'flex-start',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            {msg.role === 'assistant' && (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0
                }}
              >
                <Bot size={18} />
              </Box>
            )}

            <Box
              sx={{
                maxWidth: '82%',
                backgroundColor: msg.role === 'user' ? 'primary.main' : 'background.paper',
                color: msg.role === 'user' ? '#ffffff' : 'text.primary',
                px: 2,
                py: 1.5,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: msg.role === 'user' ? 'primary.main' : 'divider',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}
            >
              {msg.role === 'assistant' && msg.modelName && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {msg.modelName}
                  </Typography>
                  <Tooltip title={copiedId === idx ? 'Copied!' : 'Copy Response'}>
                    <IconButton size="small" onClick={() => handleCopy(msg.content, idx)} sx={{ p: 0.2 }}>
                      {copiedId === idx ? <Check size={13} color="#22c55e" /> : <Copy size={13} />}
                    </IconButton>
                  </Tooltip>
                </Box>
              )}

              {msg.content ? (
                <Box sx={{ fontSize: '0.9rem', lineHeight: 1.6, '& p': { m: 0 } }}>
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
                    {msg.content}
                  </ReactMarkdown>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                  <CircularProgress size={16} color="inherit" />
                  <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                    Generating response...
                  </Typography>
                </Box>
              )}
            </Box>

            {msg.role === 'user' && (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: 'action.selected',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.primary',
                  flexShrink: 0
                }}
              >
                <User size={18} />
              </Box>
            )}
          </Box>
        ))}
        <div ref={messagesEndRef} />
      </Paper>

      {/* Starter Prompts */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {starterPrompts.map((sp, idx) => (
          <Chip
            key={idx}
            icon={<Sparkles size={12} />}
            label={sp}
            size="small"
            onClick={() => setPrompt(sp)}
            sx={{
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              fontSize: '0.725rem',
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'action.hover' }
            }}
          />
        ))}
      </Box>

      {/* Input Composer Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 1.2,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder={`Message ${selectedModel.name || 'model'}... (Shift+Enter for newline)`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              border: 'none',
              '& fieldset': { border: 'none' }
            }
          }}
        />

        {isGenerating ? (
          <Button
            variant="contained"
            color="error"
            onClick={handleStop}
            startIcon={<Square size={14} fill="currentColor" />}
            sx={{ borderRadius: 2, height: 42, px: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Stop
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSend}
            disabled={!prompt.trim()}
            endIcon={<Send size={15} />}
            sx={{ borderRadius: 2, height: 42, px: 2.5, textTransform: 'none', fontWeight: 700 }}
          >
            Send
          </Button>
        )}
      </Paper>
    </Box>
  );
}
