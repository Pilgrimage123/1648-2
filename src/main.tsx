import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {bindDocumentLocale} from './i18n';
import './index.css';

bindDocumentLocale();

createRoot(document.getElementById('root')!).render(<App />);
