import { Navigate, Route, Routes } from 'react-router-dom';
import { SignInPage } from './pages/SignInPage';
import { ExtensionCallbackPage } from './pages/ExtensionCallbackPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/sign-in" replace />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/auth/extension-callback" element={<ExtensionCallbackPage />} />
      <Route path="*" element={<Navigate to="/sign-in" replace />} />
    </Routes>
  );
}
