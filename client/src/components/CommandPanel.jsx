import React, { useState } from 'react';
import { Send, Plus, X } from 'lucide-react';
import { socket } from '../socket';

export const CommandPanel = ({ isConnected, onSend }) => {
  const [macros, setMacros] = useState([
    { id: 1, label: 'Hello', data: 'hello', isHex: false },
    { id: 2, label: 'Ping', data: '01 02 03', isHex: true },
  ]);

  const addMacro = () => {
    setMacros([...macros, { id: Date.now(), label: 'New', data: '', isHex: false }]);
  };

  const removeMacro = (id) => {
    setMacros(macros.filter(m => m.id !== id));
  };

  const updateMacro = (id, field, value) => {
    setMacros(macros.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const sendData = (data, isHex) => {
    if (!isConnected) return;
    socket.emit('send-data', { 
        data: isHex ? data : data + (false ? '\r\n' : ''), // simplified crlf
        type: isHex ? 'hex' : 'ascii' 
    });
    if (onSend) {
        onSend(data, isHex);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-4">
         <h3 className="font-semibold text-gray-700">Quick Commands</h3>
         <button 
           onClick={addMacro}
           className="bg-blue-500 text-white p-1 rounded hover:bg-blue-600 transition"
         >
            <Plus size={18} />
         </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {macros.map((macro) => (
          <div key={macro.id} className="flex gap-2 items-center">
            {/* Input Data */}
             <div className="flex-1 flex flex-col gap-1">
                <input 
                  type="text" 
                  value={macro.data}
                  onChange={(e) => updateMacro(macro.id, 'data', e.target.value)}
                  placeholder="Data payload"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <div className="flex gap-2 items-center">
                   <input 
                    type="text"
                    value={macro.label}
                    onChange={(e) => updateMacro(macro.id, 'label', e.target.value)}
                    placeholder="Label" 
                    className="w-20 border border-gray-300 rounded px-1 py-0.5 text-xs text-gray-500"
                   />
                   <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={macro.isHex}
                        onChange={(e) => updateMacro(macro.id, 'isHex', e.target.checked)}
                      />
                      HEX
                   </label>
                </div>
             </div>

             {/* Actions */}
             <div className="flex flex-col gap-1">
                <button 
                  onClick={() => sendData(macro.data, macro.isHex)}
                  disabled={!isConnected}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-3 py-1 rounded text-sm font-medium flex items-center justify-center gap-1 transition w-20"
                >
                  <Send size={14} /> Send
                </button>
                <button 
                   onClick={() => removeMacro(macro.id)}
                   className="bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 px-3 py-1 rounded text-xs flex items-center justify-center transition w-20"
                >
                   <X size={14} /> Del
                </button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};