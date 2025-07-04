import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Web3Provider } from './components/Web3Provider';
import Dashboard from './components/Dashboard';
import AddMeal from './components/AddMeal';
import { useStore } from './store/useStore';

function AppContent() {
  const user = useStore((state) => state.user);

  useEffect(() => {
    // Prompt for OpenRouter API key if not stored
    if (!localStorage.getItem('openrouter_api_key')) {
      const key = prompt('Please enter your OpenRouter API key for decentralized AI:');
      if (key) {
        localStorage.setItem('openrouter_api_key', key);
      }
    }
  }, []);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add-meal" element={<AddMeal />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <Web3Provider>
      <AppContent />
    </Web3Provider>
  );
}

export default App;