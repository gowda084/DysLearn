import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  BookOpen, 
  FileText, 
  Brain, 
  Settings,
  Play,
  Pause,
  RotateCcw,
  Lightbulb,
  User,
  Home,
  AlertCircle,
  CheckCircle,
  XCircle,
  Trophy,
  Target
} from 'lucide-react';

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface QuizResult {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
  timeSpent: number;
}

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [textToRead, setTextToRead] = useState('');
  const [summary, setSummary] = useState('');
  const [speechRate, setSpeechRate] = useState(1);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [error, setError] = useState('');
  
  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const shouldRestartRef = useRef(false);
  const isIntentionallyStoppedRef = useRef(false);

  const quizQuestions: QuizQuestion[] = [
    {
      id: '1',
      question: 'What is the main purpose of text summarization?',
      options: [
        'To make text longer and more detailed',
        'To extract key points and make content easier to understand',
        'To change the language of the text',
        'To add more examples to the text'
      ],
      correctAnswer: 1,
      explanation: 'Text summarization helps extract the most important information from longer texts, making them easier to read and understand.',
      difficulty: 'easy'
    },
    {
      id: '2',
      question: 'Which feature helps people with dyslexia process written information better?',
      options: [
        'Smaller font sizes',
        'Text-to-speech technology',
        'More complex vocabulary',
        'Faster reading speeds'
      ],
      correctAnswer: 1,
      explanation: 'Text-to-speech technology allows people to hear the content, which can significantly help those with dyslexia process written information.',
      difficulty: 'easy'
    },
    {
      id: '3',
      question: 'What is speech recognition technology primarily used for?',
      options: [
        'Converting written text to audio',
        'Translating between languages',
        'Converting spoken words to written text',
        'Creating background music'
      ],
      correctAnswer: 2,
      explanation: 'Speech recognition technology converts spoken words into written text, allowing users to input information by speaking instead of typing.',
      difficulty: 'medium'
    },
    {
      id: '4',
      question: 'Which reading strategy is most helpful for improving comprehension?',
      options: [
        'Reading as fast as possible',
        'Skipping difficult words',
        'Breaking text into smaller sections and summarizing',
        'Reading only the first sentence of each paragraph'
      ],
      correctAnswer: 2,
      explanation: 'Breaking text into smaller, manageable sections and creating summaries helps improve understanding and retention of the material.',
      difficulty: 'medium'
    },
    {
      id: '5',
      question: 'What is the benefit of adjustable speech rate in text-to-speech applications?',
      options: [
        'It makes the voice sound more natural',
        'It allows users to control the speed based on their processing needs',
        'It reduces the file size of audio',
        'It improves the quality of the voice'
      ],
      correctAnswer: 1,
      explanation: 'Adjustable speech rate allows users to set a comfortable listening speed that matches their processing abilities and preferences.',
      difficulty: 'hard'
    }
  ];

  useEffect(() => {
    // Check for speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setSpeechSupported(true);
      
      // Initialize speech recognition
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started');
        setError('');
      };
      
      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript + ' ');
        }
        setInterimTranscript(interimTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        // Check if this is an intentionally stopped aborted error
        if (event.error === 'aborted' && isIntentionallyStoppedRef.current) {
          // Don't log or show error for intentional stops
          return;
        }
        
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow microphone access and try again.');
          setIsListening(false);
          shouldRestartRef.current = false;
        } else if (event.error === 'aborted') {
          // Only show error if it wasn't intentionally stopped
          setError('Speech recognition stopped unexpectedly. Click "Start Speaking" to begin again.');
          setIsListening(false);
          shouldRestartRef.current = false;
        } else if (event.error === 'no-speech') {
          setError('No speech detected. Listening will continue automatically...');
          shouldRestartRef.current = true;
        } else if (event.error === 'network') {
          setError('Network error. Please check your internet connection.');
          setIsListening(false);
          shouldRestartRef.current = false;
        } else {
          setError(`Speech recognition error: ${event.error}`);
          shouldRestartRef.current = true;
        }
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        setInterimTranscript('');
        setIsListening(false);
        
        if (shouldRestartRef.current && !isIntentionallyStoppedRef.current) {
          // Automatically restart recognition after a brief delay
          setTimeout(() => {
            if (shouldRestartRef.current && !isIntentionallyStoppedRef.current) {
              try {
                recognitionRef.current.start();
                setIsListening(true);
              } catch (err) {
                console.error('Error restarting speech recognition:', err);
                shouldRestartRef.current = false;
              }
            }
          }, 100);
        }
        
        // Reset the intentionally stopped flag at the end
        isIntentionallyStoppedRef.current = false;
      };
    } else {
      setSpeechSupported(false);
      setError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
    }

    // Load available voices
    const loadVoices = () => {
      const availableVoices = synthRef.current.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0 && !selectedVoice) {
        // Prefer English voices
        const englishVoice = availableVoices.find(voice => voice.lang.startsWith('en'));
        setSelectedVoice(englishVoice || availableVoices[0]);
      }
    };

    loadVoices();
    synthRef.current.addEventListener('voiceschanged', loadVoices);

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      synthRef.current.removeEventListener('voiceschanged', loadVoices);
    };
  }, [selectedVoice, isListening]);

  const requestMicrophonePermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setError('');
      return true;
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access in your browser settings.');
      return false;
    }
  };

  const toggleListening = async () => {
    if (!speechSupported) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    if (!recognitionRef.current) return;
    
    if (isListening) {
      shouldRestartRef.current = false;
      isIntentionallyStoppedRef.current = true; // Mark as intentionally stopped
      recognitionRef.current.stop();
    } else {
      // Request microphone permission first
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) return;
      
      try {
        setError('');
        shouldRestartRef.current = true;
        isIntentionallyStoppedRef.current = false; // Reset flag when starting
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Error starting speech recognition:', err);
        setError('Failed to start speech recognition. Please try again.');
        setIsListening(false);
        shouldRestartRef.current = false;
      }
    }
  };

  const speakText = (text: string) => {
    if (!text.trim()) return;
    
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    utterance.volume = 1;
    utterance.pitch = 1;
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      // Handle "interrupted" error silently as it's expected behavior
      if (event.error === 'interrupted') {
        console.log('Speech synthesis was interrupted (expected behavior)');
      } else {
        console.error('Speech synthesis error:', event.error);
      }
      setIsSpeaking(false);
    };
    
    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    synthRef.current.cancel();
    setIsSpeaking(false);
  };

  const clearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
    setError('');
    setSummary(''); // Clear summary when clearing transcript
  };

  const summarizeText = (text: string) => {
    if (!text.trim()) return;
    
    // Clean and normalize the text
    const cleanText = text.trim().replace(/\s+/g, ' ');
    
    // Split into sentences
    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length === 0) {
      setSummary('No content to summarize.');
      return;
    }
    
    if (sentences.length <= 2) {
      setSummary(cleanText);
      return;
    }
    
    // Score sentences based on word frequency and position
    const words = cleanText.toLowerCase().split(/\s+/);
    const wordFreq: { [key: string]: number } = {};
    
    // Calculate word frequencies (excluding common words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    
    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
      if (cleanWord.length > 2 && !stopWords.has(cleanWord)) {
        wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
      }
    });
    
    // Score each sentence
    const sentenceScores = sentences.map((sentence, index) => {
      const sentenceWords = sentence.toLowerCase().split(/\s+/);
      let score = 0;
      let wordCount = 0;
      
      sentenceWords.forEach(word => {
        const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
        if (cleanWord.length > 2 && !stopWords.has(cleanWord)) {
          score += wordFreq[cleanWord] || 0;
          wordCount++;
        }
      });
      
      // Normalize score by sentence length
      const normalizedScore = wordCount > 0 ? score / wordCount : 0;
      
      // Boost score for first and last sentences
      const positionBoost = (index === 0 || index === sentences.length - 1) ? 1.2 : 1;
      
      return {
        sentence: sentence.trim(),
        score: normalizedScore * positionBoost,
        index
      };
    });
    
    // Sort by score and select top sentences
    const topSentences = sentenceScores
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.ceil(sentences.length * 0.3))) // Take top 30% of sentences, minimum 1
      .sort((a, b) => a.index - b.index); // Re-sort by original order
    
    // Create summary
    let summary = topSentences.map(item => item.sentence).join('. ');
    
    // Ensure it ends with proper punctuation
    if (!summary.match(/[.!?]$/)) {
      summary += '.';
    }
    
    // If summary is still too long, take only the first sentence
    if (summary.length > cleanText.length * 0.7) {
      summary = topSentences[0]?.sentence || sentences[0];
      if (!summary.match(/[.!?]$/)) {
        summary += '.';
      }
    }
    
    setSummary(summary);
  };

  // Quiz functions
  const startQuiz = () => {
    setQuizStarted(true);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizResults([]);
    setShowResults(false);
    setQuizStartTime(Date.now());
    setQuestionStartTime(Date.now());
  };

  const selectAnswer = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
  };

  const submitAnswer = () => {
    if (selectedAnswer === null) return;
    
    const currentQuestion = quizQuestions[currentQuestionIndex];
    const timeSpent = Date.now() - questionStartTime;
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    
    const result: QuizResult = {
      questionId: currentQuestion.id,
      selectedAnswer,
      isCorrect,
      timeSpent
    };
    
    setQuizResults(prev => [...prev, result]);
    
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setQuestionStartTime(Date.now());
    } else {
      setShowResults(true);
    }
  };

  const resetQuiz = () => {
    setQuizStarted(false);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizResults([]);
    setShowResults(false);
    setQuizStartTime(0);
    setQuestionStartTime(0);
  };

  const getQuizScore = () => {
    const correctAnswers = quizResults.filter(result => result.isCorrect).length;
    return Math.round((correctAnswers / quizQuestions.length) * 100);
  };

  const getPerformanceMessage = (score: number) => {
    if (score >= 90) return "Excellent! You have a great understanding of assistive learning technologies.";
    if (score >= 70) return "Good job! You're making solid progress in understanding these concepts.";
    if (score >= 50) return "Not bad! Keep practicing to improve your understanding.";
    return "Keep learning! Review the concepts and try again to improve your score.";
  };

  const ErrorMessage = ({ message }: { message: string }) => (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
      <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
      <p className="text-red-800">{message}</p>
    </div>
  );

  const TabButton = ({ id, icon: Icon, label, isActive }: { 
    id: string; 
    icon: React.ComponentType<any>; 
    label: string; 
    isActive: boolean; 
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-300 ${
        isActive 
          ? 'bg-blue-600 text-white shadow-lg scale-105' 
          : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600'
      }`}
      aria-label={label}
    >
      <Icon size={24} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );

  const ActionButton = ({ 
    onClick, 
    icon: Icon, 
    label, 
    variant = 'primary',
    disabled = false 
  }: {
    onClick: () => void;
    icon: React.ComponentType<any>;
    label: string;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
  }) => {
    const baseClasses = "flex items-center gap-3 px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
    const variantClasses = {
      primary: "bg-blue-600 text-white hover:bg-blue-700 active:scale-95",
      secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300 active:scale-95",
      danger: "bg-red-500 text-white hover:bg-red-600 active:scale-95"
    };
    
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${baseClasses} ${variantClasses[variant]}`}
        aria-label={label}
      >
        <Icon size={24} />
        {label}
      </button>
    );
  };

  const renderHome = () => (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto flex items-center justify-center mb-6">
          <Brain size={40} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2">DysLearn</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Your personalized AI-powered learning companion designed specifically for learners with dyslexia
        </p>
      </div>

      {!speechSupported && (
        <ErrorMessage message="Speech recognition is not supported in this browser. For the best experience, please use Chrome, Edge, or Safari." />
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <Mic size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-blue-800">Voice Notes</h3>
              <p className="text-blue-600">Speak your thoughts</p>
            </div>
          </div>
          <p className="text-blue-700 mb-4">Transform your speech into organized notes with our advanced speech recognition.</p>
          <button
            onClick={() => setActiveTab('speech')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start Speaking
          </button>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
              <Volume2 size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-800">Read Aloud</h3>
              <p className="text-green-600">Listen to any text</p>
            </div>
          </div>
          <p className="text-green-700 mb-4">Have any text read aloud with customizable speed and voice options.</p>
          <button
            onClick={() => setActiveTab('reader')}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Start Reading
          </button>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
              <FileText size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-purple-800">Smart Summary</h3>
              <p className="text-purple-600">Key points extracted</p>
            </div>
          </div>
          <p className="text-purple-700 mb-4">Get concise summaries of long texts to improve comprehension.</p>
          <button
            onClick={() => setActiveTab('summary')}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Summarize Text
          </button>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl border border-orange-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center">
              <Target size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-orange-800">Knowledge Quiz</h3>
              <p className="text-orange-600">Test your progress</p>
            </div>
          </div>
          <p className="text-orange-700 mb-4">Take interactive quizzes to check your understanding and track improvement.</p>
          <button
            onClick={() => setActiveTab('quiz')}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
          >
            Take Quiz
          </button>
        </div>
      </div>
    </div>
  );

  const renderSpeechToText = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Voice Notes</h2>
        <p className="text-gray-600 text-lg">Speak naturally and watch your words appear</p>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="flex justify-center gap-4">
        <ActionButton
          onClick={toggleListening}
          icon={isListening ? MicOff : Mic}
          label={isListening ? 'Stop Listening' : 'Start Speaking'}
          variant={isListening ? 'danger' : 'primary'}
          disabled={!speechSupported}
        />
        <ActionButton
          onClick={clearTranscript}
          icon={RotateCcw}
          label="Clear"
          variant="secondary"
        />
      </div>

      {isListening && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-red-100 text-red-800 px-4 py-2 rounded-full">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            Listening... Speak now!
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Your Notes</label>
          <div className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap min-h-[200px] p-4 bg-gray-50 rounded-xl">
            {transcript || 'Your spoken words will appear here...'}
            {interimTranscript && (
              <span className="text-gray-500 italic">{interimTranscript}</span>
            )}
          </div>
          {transcript && (
            <div className="mt-4 flex gap-3">
              <ActionButton
                onClick={() => speakText(transcript)}
                icon={isSpeaking ? Pause : Play}
                label={isSpeaking ? 'Stop Reading' : 'Read Aloud'}
                variant="secondary"
              />
              <ActionButton
                onClick={() => summarizeText(transcript)}
                icon={Lightbulb}
                label="Summarize"
                variant="secondary"
              />
            </div>
          )}
        </div>

        {summary && (
          <div className="bg-white rounded-2xl border-2 border-purple-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Summary</label>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 min-h-[200px]">
              <div className="text-lg leading-relaxed text-gray-800">
                {summary}
              </div>
            </div>
            <div className="mt-4">
              <ActionButton
                onClick={() => speakText(summary)}
                icon={isSpeaking ? Pause : Play}
                label={isSpeaking ? 'Stop Reading' : 'Read Summary'}
                variant="secondary"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTextToSpeech = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Text Reader</h2>
        <p className="text-gray-600 text-lg">Paste any text and have it read aloud</p>
      </div>

      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Speech Speed</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speechRate}
              onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
            <span className="text-sm text-gray-600">{speechRate}x</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Voice</label>
            <select
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const voice = voices.find(v => v.name === e.target.value);
                setSelectedVoice(voice || null);
              }}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {voices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Text to Read</label>
          <textarea
            value={textToRead}
            onChange={(e) => setTextToRead(e.target.value)}
            placeholder="Paste or type text here to have it read aloud..."
            className="w-full h-64 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg leading-relaxed resize-none"
          />
        </div>

        <div className="flex gap-4 justify-center">
          <ActionButton
            onClick={() => speakText(textToRead)}
            icon={isSpeaking ? Pause : Play}
            label={isSpeaking ? 'Pause' : 'Read Aloud'}
            variant="primary"
            disabled={!textToRead.trim()}
          />
          <ActionButton
            onClick={stopSpeaking}
            icon={VolumeX}
            label="Stop"
            variant="secondary"
            disabled={!isSpeaking}
          />
        </div>
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Smart Summary</h2>
        <p className="text-gray-600 text-lg">Get key points from long texts</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Original Text</label>
          <textarea
            value={textToRead}
            onChange={(e) => setTextToRead(e.target.value)}
            placeholder="Paste long text here to get a summary..."
            className="w-full h-64 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg leading-relaxed resize-none"
          />
          <div className="mt-4">
            <ActionButton
              onClick={() => summarizeText(textToRead)}
              icon={Lightbulb}
              label="Generate Summary"
              variant="primary"
              disabled={!textToRead.trim()}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Summary</label>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 h-64 overflow-y-auto">
            <div className="text-lg leading-relaxed text-gray-800">
              {summary || 'Summary will appear here...'}
            </div>
          </div>
          {summary && (
            <div className="mt-4">
              <ActionButton
                onClick={() => speakText(summary)}
                icon={isSpeaking ? Pause : Play}
                label={isSpeaking ? 'Stop Reading' : 'Read Summary'}
                variant="secondary"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderQuiz = () => {
    if (!quizStarted) {
      // Quiz start screen
      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Knowledge Quiz</h2>
            <p className="text-gray-600 text-lg">Test your understanding of assistive learning technologies</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-8 text-center">
            <Trophy size={64} className="text-orange-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-orange-800 mb-4">Ready to Test Your Knowledge?</h3>
            <p className="text-orange-700 mb-6 text-lg">
              This quiz contains {quizQuestions.length} questions about speech recognition, text-to-speech, 
              and other assistive technologies. Take your time and do your best!
            </p>
            <ActionButton
              onClick={startQuiz}
              icon={Target}
              label="Start Quiz"
              variant="primary"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">{quizQuestions.filter(q => q.difficulty === 'easy').length}</div>
              <div className="text-sm text-gray-600">Easy Questions</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <div className="text-2xl font-bold text-yellow-600 mb-2">{quizQuestions.filter(q => q.difficulty === 'medium').length}</div>
              <div className="text-sm text-gray-600">Medium Questions</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <div className="text-2xl font-bold text-red-600 mb-2">{quizQuestions.filter(q => q.difficulty === 'hard').length}</div>
              <div className="text-sm text-gray-600">Hard Questions</div>
            </div>
          </div>
        </div>
      );
    }

    if (showResults) {
      // Quiz results screen
      const score = getQuizScore();
      const totalTime = Math.round((Date.now() - quizStartTime) / 1000);
      
      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Quiz Results</h2>
            <p className="text-gray-600 text-lg">Here's how you performed</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-purple-100 rounded-2xl p-8 text-center">
            <div className="text-6xl font-bold text-blue-600 mb-4">{score}%</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Your Score</h3>
            <p className="text-gray-600 mb-4">{getPerformanceMessage(score)}</p>
            <div className="text-sm text-gray-500">
              Completed in {Math.floor(totalTime / 60)}:{(totalTime % 60).toString().padStart(2, '0')}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800">Question Review</h3>
            {quizQuestions.map((question, index) => {
              const result = quizResults[index];
              const isCorrect = result?.isCorrect;
              
              return (
                <div key={question.id} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCorrect ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {isCorrect ? (
                        <CheckCircle size={20} className="text-green-600" />
                      ) : (
                        <XCircle size={20} className="text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 mb-2">
                        Question {index + 1}: {question.question}
                      </h4>
                      <div className="space-y-2 mb-3">
                        {question.options.map((option, optionIndex) => (
                          <div
                            key={optionIndex}
                            className={`p-2 rounded-lg text-sm ${
                              optionIndex === question.correctAnswer
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : optionIndex === result?.selectedAnswer && !isCorrect
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : 'bg-gray-50 text-gray-700'
                            }`}
                          >
                            {option}
                            {optionIndex === question.correctAnswer && (
                              <span className="ml-2 text-green-600">✓ Correct</span>
                            )}
                            {optionIndex === result?.selectedAnswer && !isCorrect && (
                              <span className="ml-2 text-red-600">✗ Your answer</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          <strong>Explanation:</strong> {question.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center">
            <ActionButton
              onClick={resetQuiz}
              icon={RotateCcw}
              label="Take Quiz Again"
              variant="primary"
            />
          </div>
        </div>
      );
    }

    // Quiz question screen
    const currentQuestion = quizQuestions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Knowledge Quiz</h2>
          <p className="text-gray-600 text-lg">
            Question {currentQuestionIndex + 1} of {quizQuestions.length}
          </p>
        </div>

        <div className="bg-gray-200 rounded-full h-2 mb-6">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                currentQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {currentQuestion.difficulty}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              {currentQuestion.question}
            </h3>
          </div>

          <div className="space-y-3 mb-8">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => selectAnswer(index)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedAnswer === index
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedAnswer === index
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {selectedAnswer === index && (
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className="text-lg">{option}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={() => speakText(currentQuestion.question + '. ' + currentQuestion.options.join('. '))}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Volume2 size={20} />
              Listen to Question
            </button>
            
            <ActionButton
              onClick={submitAnswer}
              icon={currentQuestionIndex === quizQuestions.length - 1 ? Trophy : Target}
              label={currentQuestionIndex === quizQuestions.length - 1 ? 'Finish Quiz' : 'Next Question'}
              variant="primary"
              disabled={selectedAnswer === null}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Navigation */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-8 sticky top-4 z-10">
          <div className="flex justify-center gap-2 md:gap-4">
            <TabButton id="home" icon={Home} label="Home" isActive={activeTab === 'home'} />
            <TabButton id="speech" icon={Mic} label="Voice" isActive={activeTab === 'speech'} />
            <TabButton id="reader" icon={Volume2} label="Reader" isActive={activeTab === 'reader'} />
            <TabButton id="summary" icon={FileText} label="Summary" isActive={activeTab === 'summary'} />
            <TabButton id="quiz" icon={Target} label="Quiz" isActive={activeTab === 'quiz'} />
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          {activeTab === 'home' && renderHome()}
          {activeTab === 'speech' && renderSpeechToText()}
          {activeTab === 'reader' && renderTextToSpeech()}
          {activeTab === 'summary' && renderSummary()}
          {activeTab === 'quiz' && renderQuiz()}
        </div>
      </div>
    </div>
  );
}

export default App;