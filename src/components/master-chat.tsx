'use client';

import { useState, useEffect } from 'react';
import * as actions from '@/lib/actions';

export default function MasterChat() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    const res = await actions.getChatMessagesAction();
    if (res.success && res.data) {
      setMessages(res.data);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    setLoading(true);
    
    // Save User message
    await actions.saveChatMessageAction(input, 'master');

    // Call API
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
    });
    const data = await response.json();

    // Save AI response
    await actions.saveChatMessageAction(data.text, 'ai');
      
    setInput('');
    setLoading(false);
    loadMessages();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-lg border border-slate-800 shadow-inner">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
            <div key={m.id} className={`p-3 rounded-lg ${m.sender === 'master' ? 'bg-slate-800 ml-auto' : 'bg-indigo-950 mr-auto'}`}>
                <b>{m.sender === 'master' ? 'Master' : 'AI'}:</b> {m.content}
            </div>
        ))}
      </div>
      <div className="p-4 border-t border-slate-800">
        <div className="flex gap-2">
            <input 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                className="flex-1 bg-slate-900 border border-slate-700 p-2 rounded" 
                placeholder="Chiedi al Master AI..."
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage} disabled={loading} className="bg-indigo-700 hover:bg-indigo-600 px-4 py-2 rounded">
                {loading ? '...' : 'Invia'}
            </button>
        </div>
      </div>
    </div>
  );
}
