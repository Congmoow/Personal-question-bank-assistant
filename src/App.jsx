import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QuestionBankProvider, QuestionProvider } from './contexts';
import Layout from './components/Layout';
import TitleBar from './components/TitleBar';
import Dashboard from './pages/Dashboard';
import ManualEntry from './pages/ManualEntry';
import CsvImport from './pages/CsvImport';
import AiImport from './pages/AiImport';
import Practice from './pages/Practice';
import WrongBook from './pages/WrongBook';
import QuestionPreview from './pages/QuestionPreview';
import Settings from './pages/Settings';
import AiChat from './pages/AiChat';

function App() {
  return (
    <div className="h-screen flex flex-col">
      <TitleBar />
      <div className="flex-1 overflow-hidden">
        <QuestionBankProvider>
          <QuestionProvider>
            <Router>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="manual-entry" element={<ManualEntry />} />
                  <Route path="csv-import" element={<CsvImport />} />
                  <Route path="ai-import" element={<AiImport />} />
                  <Route path="practice" element={<Practice />} />
                  <Route path="wrong-book" element={<WrongBook />} />
                  <Route path="question-preview" element={<QuestionPreview />} />
                  <Route path="ai-chat" element={<AiChat />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Routes>
            </Router>
          </QuestionProvider>
        </QuestionBankProvider>
      </div>
    </div>
  );
}

export default App;
