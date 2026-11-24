import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Search,
  Code2,
  Brain,
  Languages,
  Calendar,
  Sparkles,
  Copy,
  ArrowRight,
  Check,
  BookOpen
} from 'lucide-react';

const PROMPT_CATEGORIES = [
  { id: 'all', label: 'All Prompts' },
  { id: 'coding', label: 'Code & DSA', icon: Code2 },
  { id: 'concepts', label: 'Explain Concepts', icon: Brain },
  { id: 'indian-lang', label: 'Indian Languages', icon: Languages },
  { id: 'productivity', label: 'Study & Planning', icon: Calendar },
  { id: 'creative', label: 'Image & Creative', icon: Sparkles }
];

const CURATED_PROMPTS = [
  {
    id: 'p1',
    category: 'concepts',
    title: 'Explain MEMS Micropump with Diagram',
    description: 'Detailed mechanical and fluid dynamic principles of piezoelectric/electrostatic MEMS micropumps with ASCII architecture diagram.',
    prompt: 'Explain the working principles, actuation mechanisms (piezoelectric vs electrostatic), and biomedical applications of a MEMS micropump. Include a clear ASCII diagram illustrating the fluid chambers, inlet/outlet check valves, and diaphragm displacement.',
    tags: ['Engineering', 'MEMS', 'Hardware', 'Diagrams'],
    color: '#8b5cf6'
  },
  {
    id: 'p2',
    category: 'coding',
    title: 'Solve DSA Problem in Java (Graph BFS/DFS)',
    description: 'Optimized Java solution with time/space complexity analysis, edge cases, and unit tests.',
    prompt: 'Solve the "Word Ladder" problem in Java using Bidirectional Breadth-First Search (BFS). Explain time and space complexity, handle edge cases, and include a step-by-step trace of how the word queue transitions.',
    tags: ['Java', 'Algorithms', 'BFS', 'Graph'],
    color: '#3b82f6'
  },
  {
    id: 'p3',
    category: 'creative',
    title: 'Generate a 3D Robot Arm Image',
    description: 'FLUX-ready prompt for generating a photorealistic robotic manipulator in a high-tech laboratory.',
    prompt: 'Generate a 3D photorealistic robotic manipulator arm with carbon fiber joints, illuminated emerald status rings, precision gripper holding a silicon microchip, 8k resolution, cinematic lighting, shallow depth of field, high-tech engineering laboratory background.',
    tags: ['FLUX.1', 'Image Gen', 'Robotics', '3D Render'],
    color: '#ec4899'
  },
  {
    id: 'p4',
    category: 'productivity',
    title: 'Summarize Technical Research Paper',
    description: 'Extract core methodologies, mathematical breakthroughs, empirical benchmarks, and future directions.',
    prompt: 'Summarize this technical paper into structured executive takeaways: 1. Core Problem & Motivation, 2. Key Mathematical Breakthroughs, 3. Empirical Benchmarks vs Baselines, 4. Limitations and Future Work. Keep explanations crisp and rigorous.',
    tags: ['Research', 'PDF Analysis', 'Executive Summary'],
    color: '#f59e0b'
  },
  {
    id: 'p5',
    category: 'concepts',
    title: 'Latest AI News & Breakthroughs',
    description: 'Live web synthesis of the most impactful breakthroughs in LLMs, robotics, and open-weights models.',
    prompt: 'Search the web for the latest artificial intelligence news, frontier model releases, and benchmark breakthroughs from the past week. Provide bulleted takeaways with source attribution and technical implications.',
    tags: ['Web Search', 'AI Trends', 'Live Research'],
    color: '#10b981'
  },
  {
    id: 'p6',
    category: 'indian-lang',
    title: 'Marathi Technical Architecture Guide',
    description: 'Explain microservices and cloud deployment in lucid, authentic Marathi (मराठी).',
    prompt: 'मायक्रोसर्व्हिसेस आर्किटेक्चर (Microservices Architecture) आणि मोनोलिथिक आर्किटेक्चरमधील मुख्य फरक उदाहरणासह सोप्या मराठीत समजावून सांगा. क्लाउड डिप्लॉयमेंट, स्केलेबिलिटी आणि फॉल्ट टॉलरन्स यांवर भर द्या.',
    tags: ['मराठी', 'Marathi', 'Microservices', 'Indic'],
    color: '#f97316'
  },
  {
    id: 'p7',
    category: 'indian-lang',
    title: 'Hindi DSA Concept Explainer',
    description: 'Explain Dynamic Programming (DP) memoization vs tabulation in standard Hindi (हिंदी).',
    prompt: 'डायनामिक प्रोग्रामिंग (Dynamic Programming) में मेमोइज़ेशन (Memoization) और टेबुलेशन (Tabulation) के बीच क्या अंतर है? 0/1 Knapsack समस्या के उदाहरण के साथ शुद्ध और सरल हिंदी में कोड सहित समझाइए।',
    tags: ['हिंदी', 'Hindi', 'DSA', 'Knapsack'],
    color: '#f97316'
  },
  {
    id: 'p8',
    category: 'coding',
    title: 'React Concurrent & Custom Hooks Architecture',
    description: 'Production-ready TypeScript custom hook for optimistic UI updates with rollback.',
    prompt: 'Write a production-ready React custom hook `useOptimisticMutation` in TypeScript. Support automatic rollback upon API failure, abort controllers, pending state, and provide full Jest/React Testing Library unit tests.',
    tags: ['React', 'TypeScript', 'Custom Hook', 'Unit Tests'],
    color: '#3b82f6'
  },
  {
    id: 'p9',
    category: 'productivity',
    title: 'GATE & Engineering Sprint Study Planner',
    description: 'Create an intensive 30-day mastery schedule for Operating Systems, DBMS, and Algorithms.',
    prompt: 'Design an intensive 30-day sprint study schedule for Computer Science engineering exams (OS, DBMS, Computer Networks, and DSA). Group topics by weightage, include spaced repetition intervals, and daily practice problem quotas.',
    tags: ['Study Planner', 'GATE CS', 'Productivity'],
    color: '#10b981'
  }
];

export default function PromptLibraryView({ onUsePrompt, onBackToChat }) {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const filteredPrompts = CURATED_PROMPTS.filter((item) => {
    const matchesTab = activeTab === 'all' || item.category === activeTab;
    const matchesSearch =
      !search.trim() ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Box
      sx={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        backgroundColor: 'background.default',
        p: { xs: 2, sm: 4 },
        maxWidth: 1100,
        mx: 'auto'
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <BookOpen size={18} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 750, letterSpacing: '-0.02em' }}>
              Prompt Library
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Curated, production-tested prompts across engineering, DSA, concept visualization, and Indian languages.
          </Typography>
        </Box>

        {onBackToChat && (
          <Button variant="outlined" onClick={onBackToChat} size="small" sx={{ borderRadius: 2 }}>
            Back to Chat
          </Button>
        )}
      </Box>

      {/* Search & Categories Bar */}
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search prompts by keyword or tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            flex: 1,
            backgroundColor: 'background.paper',
            borderRadius: 2,
            '& fieldset': { borderColor: 'divider' }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} color="#10b981" />
              </InputAdornment>
            )
          }}
        />

        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 38,
            '& .MuiTab-root': {
              minHeight: 38,
              py: 0.5,
              px: 1.5,
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2
            }
          }}
        >
          {PROMPT_CATEGORIES.map((cat) => (
            <Tab key={cat.id} value={cat.id} label={cat.label} />
          ))}
        </Tabs>
      </Box>

      {/* Prompts Grid */}
      <Grid container spacing={2.5}>
        {filteredPrompts.map((item) => (
          <Grid item xs={12} md={6} key={item.id}>
            <Card
              variant="outlined"
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 3,
                borderColor: 'background.cardBorder',
                backgroundColor: 'background.card',
                backdropFilter: 'blur(12px)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                '&:hover': {
                  borderColor: 'primary.main',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.12)'
                }
              }}
            >
              <CardContent sx={{ flex: 1, p: 2.2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.925rem' }}>
                    {item.title}
                  </Typography>
                  <Tooltip title={copiedId === item.id ? 'Copied!' : 'Copy prompt text'}>
                    <IconButton
                      size="small"
                      onClick={() => handleCopy(item.id, item.prompt)}
                      sx={{ color: copiedId === item.id ? 'primary.main' : 'text.secondary' }}
                    >
                      {copiedId === item.id ? <Check size={16} /> : <Copy size={16} />}
                    </IconButton>
                  </Tooltip>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.825rem', mb: 1.8, lineHeight: 1.55 }}>
                  {item.description}
                </Typography>

                <Box
                  sx={{
                    p: 1.4,
                    borderRadius: 2,
                    backgroundColor: 'background.default',
                    border: '1px solid',
                    borderColor: 'divider',
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    color: 'text.secondary',
                    lineHeight: 1.5,
                    maxHeight: 90,
                    overflowY: 'auto'
                  }}
                >
                  {item.prompt}
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 1.8 }}>
                  {item.tags.map((tag) => (
                    <Chip
                      key={tag}
                      size="small"
                      label={tag}
                      sx={{
                        height: 20,
                        fontSize: '0.675rem',
                        fontWeight: 600,
                        backgroundColor: 'background.default',
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    />
                  ))}
                </Box>
              </CardContent>

              <CardActions sx={{ px: 2.2, pb: 2, pt: 0, justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  endIcon={<ArrowRight size={14} />}
                  onClick={() => onUsePrompt?.(item.prompt)}
                  sx={{ borderRadius: 2, fontWeight: 650, fontSize: '0.78rem', px: 1.6 }}
                >
                  Use Prompt
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
