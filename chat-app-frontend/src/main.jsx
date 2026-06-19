
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ChatPage from './ChatPage.jsx'
import Room from './Room.jsx'
import { BrowserRouter,Routes,Route} from "react-router-dom";

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path='/create-room' element={<Room/>} />
    </Routes>
    </BrowserRouter>
)
