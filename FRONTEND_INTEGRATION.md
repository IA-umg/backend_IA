# Guía de Integración (Frontend React + TypeScript)

Este documento es la referencia técnica para conectar la interfaz del usuario al **Backend RAG** (Hono/PostgreSQL). 

Con un stack basado en **React**, **TypeScript**, y empaquetado con **Vite**.

---

## 1. Configuración de Entorno en React/Vite

En tu repositorio de frontend, el archivo `.env` debería apuntar a la URl local (o de producción) del backend:

```env
# .env (Frontend Vite)
VITE_API_URL=http://localhost:3000
```

---

## 2. Tipados Base (TypeScript)

A continuación tienes los interfaces recomendados para mapear el contrato API a tu frontend. Guarda esto en un archivo como `src/types/api.types.ts`:

```typescript
// src/types/api.types.ts

export interface AuthResponse {
  usuario: {
    id: number;
    email: string;
    nombre: string;
  };
  token: string;
  tokenType: string; // "Bearer"
}

export interface RagContextItem {
  id: string | number;
  tipoFuente: "documento" | "base_datos";
  identificador: string;
  fuente: string;
  contenido: string;
  score: number;
  metadata: Record<string, any>;
}

export interface RagQueryRequest {
  question: string;
  provider?: "google" | "groq"; // Opcional, defecto: "google"
  filtrosMetadata?: Record<string, any>;
  incluirRegistros?: boolean;
  topK?: number; // Total fragments limit (def: 5)
}

export interface RagQueryResponse {
  ok: boolean;
  answer: string;
  context: RagContextItem[]; 
  fragmentosUsados: RagContextItem[];
  metadata: {
    latencyMs: number;
    provider: string; // "google" o "groq"
    embeddingModel: string;
    llmModel: string;
    retrieval: Record<string, any>; // Stats debug
  };
}

export interface SystemStatsResponse {
  ok: boolean;
  totalDocumentos: number;
  totalFuentes: number;
  vectorSearchEnabled: boolean;
  config: Record<string, any>;
}
```

---

## 3. Endpoints Principales

### 3.1. Autenticación Básica
El modulo no requiere validación para enviar un prompt (RAG), pero el login servirá para proteger las vistas.

**`POST /api/auth/login`**
```typescript
async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  
  if (!res.ok) throw new Error("Error en login");
  return res.json();
}
```

### 3.2. Chatear / Query RAG
Este es el endpoint core. Recibe la pregunta (prompt del usuario), e instruye a la base de datos extraer el contexto y procesar con AI la respuesta.

**`POST /api/query`**
```typescript
async function sendRagQuery(req: RagQueryRequest): Promise<RagQueryResponse> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Si tienes auth habilitado y envias headers de Session, insertalo aqui:
      // "Authorization": `Bearer ${token}` 
    },
    // Aqui puedes probar "provider": "groq" para evaluar LLaMA vs Gemini
    body: JSON.stringify(req), 
  });
  
  if (!res.ok) {
     const errorBody = await res.json();
     throw new Error(errorBody.message || "Error al procesar consulta RAG");
  }
  return res.json();
}
```

**Manejo Rápido en un Componente React:**
```tsx
import { useState } from 'react';
import type { RagQueryResponse } from '../types/api.types';

export function ChatBox() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<RagQueryResponse | null>(null);

  const handleAsk = async () => {
    const data = await sendRagQuery({ 
      question, 
      provider: "google", // Opcional, permite evaluar motores A/B
      incluirRegistros: true 
    });
    setResponse(data);
  };

  return (
    <div>
      <input value={question} onChange={(e) => setQuestion(e.target.value)} />
      <button onClick={handleAsk}>Enviar</button>
      
      {response && (
        <div className="answer-card">
           <p className="ai-response">{response.answer}</p>
           <span className="timing">{response.metadata.latencyMs} ms procesado con {response.metadata.provider}</span>
           
           <h4>Fuentes:</h4>
           <ul>
             {response.fragmentosUsados.map(frag => (
               <li key={frag.id}>
                 [{frag.tipoFuente}] {frag.fuente} — (Score: {frag.score.toFixed(2)})
               </li>
             ))}
           </ul>
        </div>
      )}
    </div>
  );
}
```

### 3.2.1. Chatear (Modo Streaming via SSE)
Para conseguir la experiencia de escritura a tiempo real de ChatGPT, puedes enviarle la bandera `stream: true` a `/api/query`. Esto causa que el backend devuelva la respuesta en formato **Server-Sent Events (SSE)**.

**Recomendado consumiendo el stream nativamente:**
```typescript
async function sendRagQueryStream(
  question: string, 
  onMetadata: (metadata: any) => void, 
  onChunk: (text: string) => void
) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, stream: true, provider: "google" })
  });
  
  if (!res.body) throw new Error("No ReadableStream available");

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunkStr = decoder.decode(value, { stream: true });
    // Limpia y parsea el SSE (ej: "data: {...}\n\n")
    const events = chunkStr.split('\n\n').filter(Boolean);
    
    for (const ev of events) {
      if (ev.startsWith("event: metadata")) {
         // El primer bloque contiene el context y las metricas
         const dataStr = ev.split('\ndata: ')[1];
         if (dataStr) onMetadata(JSON.parse(dataStr));
      } 
      else if (ev.startsWith("data: ")) {
         const dataStr = ev.replace("data: ", "").trim();
         if (dataStr === "[DONE]") return; // Fin del stream
         
         const payload = JSON.parse(dataStr);
         if (payload.chunk) onChunk(payload.chunk);
      }
    }
  }
}
```

```tsx
// Ejemplo de uso en tu componente React
const handleAskStream = async () => {
    let fullText = "";
    await sendRagQueryStream(
       "Cual es mi temario?", 
       // Callback inicial (Recibes las fuentes de inmediato)
       (stats) => setResponseProps(stats), 
       // Callback en tiempo real (Te llegan las palabras de la IA)
       (chunk) => {
         fullText += chunk;
         setAnswerText(fullText); // Actualiza estado visual
       }
    );
};
```

### 3.3. Ingesta de Archivos (Upload Form)
Generalmente reservado a un "panel admin" (Crear UI para subir archivos), para popular PDF's o archivos a la base RAG vectorial. Tienes que enviar form-data (no JSON).

**`POST /api/ingest/archivo`**
```typescript
async function uploadDocument(file: File, curso: string): Promise<any> {
  const formData = new FormData();
  formData.append("file", file); // Importante: Key name es "file" o "files" (multiple)
  formData.append("curso", curso);
  formData.append("reemplazar", "true"); // Elimina la versión antigua del server si existe

  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ingest/archivo`, {
    method: "POST", // Al usar fetch con FormData, NO mandes Content-Type
    body: formData,
  });

  return res.json();
}
```

### 3.4. Estadísticas en tiempo Real
Perfecto para mostrar cuán poblado está tu contexto o qué motores estás referenciando para el entregable del curso. (Crear UI para mostrar estadísticas)

**`GET /api/stats`**
```typescript
async function getSystemStats(): Promise<SystemStatsResponse> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/stats`);
  return res.json();
}
```

---

## 4. Estándares y Casos de Edge
* **CORS:** El backend Hono ya implementa el wildcard `*` de CORS para evitar desajustes pre-flight.
* **Manejo de Errores Restricto RAG:** Si la I.A. no contiene información, su output por rubrica será SIEMPRE y textualmente: *"No tengo evidencia suficiente en los documentos recuperados."*
* **Latencia (`latencyMs`):** Útil para tu panel de Debug / Analítica en React, viene directamente inyectado en `response.metadata`.
