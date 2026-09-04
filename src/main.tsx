import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { dbService } from './services/databaseService'

async function bootstrap() {
  try {
    await dbService.init();
  } catch (error) {
    console.error("Critical error starting database:", error);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap();
