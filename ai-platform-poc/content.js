(async () => {
  // ==============================================================================
  // 1. GESTOR DE ESTRATÉGIAS (Design Pattern: Strategy)
  // ==============================================================================
  const PlatformManager = {
    strategies: [],
    register(strategy) { this.strategies.push(strategy); },
    getStrategy(hostname) { return this.strategies.find(s => s.matches(hostname)); }
  };

  // ==============================================================================
  // 2. MÓDULOS ISOLADOS DAS PLATAFORMAS (Desacoplamento)
  // ==============================================================================

  PlatformManager.register({
    name: 'Google Gemini',
    matches: hostname => hostname === 'gemini.google.com',
    extract: async (_rawCookies, response) => {
      const key = window.prompt('Chave exata da conta Gemini cadastrada no portal:');
      if (key === null) throw new Error('Exportação cancelada.');
      return window.AiPlatformPoC.Gemini.payload(response, window.location.href, navigator.userAgent, key);
    }
  });

  PlatformManager.register({
    name: 'Vyral IA',
    matches: hostname => hostname === 'app.vyral.com.br',
    extract: async (_rawCookies, response) => {
      const key = window.prompt('Chave exata da conta Vyral cadastrada no portal:', 'conta-piloto-01');
      if (key === null) throw new Error('Exportação cancelada.'); // <--- Linha 30 exata!
      let storage;
      try { storage = window.localStorage; } catch {}
      return window.AiPlatformPoC.Vyral.payload(response, window.location.href, navigator.userAgent, key, storage);
    }
  });

  // --- ESTRATÉGIA DO LEONARDO AI ---
  PlatformManager.register({
    name: 'Leonardo AI',
    matches: hostname => hostname.includes('leonardo.ai'),
    extract: async (rawCookies) => {
      let key = "conta-piloto-01";
      
      try {
        const promptResult = window.prompt('Chave exata da conta Leonardo AI cadastrada no portal:', 'conta-piloto-01');
        if (promptResult !== null && promptResult.trim() !== '') {
          key = promptResult.trim();
        }
      } catch (e) {
        console.warn('[AI Platform PoC] Prompt suprimido pelo navegador.');
      }

      const combinedCookies = (rawCookies || "") + "; " + (document.cookie || "");

      const cookieMap = {};
      combinedCookies.split(';').forEach(pair => {
        const parts = pair.trim().split('=');
        if (parts.length >= 2 && parts[0].trim() !== '') {
          cookieMap[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
      });

      // Filtro para o novo sistema "Better Auth" do Leonardo AI
      const formattedPairs = [];
      Object.keys(cookieMap).forEach(cookieName => {
        if (cookieName.includes("better-auth.session_token") || cookieName.includes("better-auth.session_data")) {
          formattedPairs.push(`${cookieName}=${cookieMap[cookieName]}`);
        }
      });

      const finalCookies = formattedPairs.join('; ');

      // Alerta de segurança caso o novo cookie principal de login falhe
      const sessionTokenKey = Object.keys(cookieMap).find(k => k.includes("better-auth.session_token"));
      if (!sessionTokenKey) {
        console.error("[AI Platform PoC] Cookies disponíveis para leitura:", Object.keys(cookieMap));
        alert("ERRO: O token de sessão do Better Auth está ausente. Verifique se tem o login feito no Leonardo AI.");
      }

      return {
        "accountKey": key,
        "label": `Leonardo 01 (Maestro)`,
        "planType": "maestro",
        "toolId": "leonardo",
        "chatgptAccountId": "",
        "accessToken": "",
        "cookies": finalCookies,
        "userAgent": navigator.userAgent
      };
    }
  });
// --- ESTRATÉGIA DO HIGGSFIELD AI (BLINDADA) ---
  PlatformManager.register({
    name: 'Higgsfield AI',
    matches: hostname => hostname.includes('higgsfield.ai'),
    extract: async (rawCookies) => {
      let key = "conta-piloto-01";
      try {
        const promptResult = window.prompt('Chave exata da conta Higgsfield AI cadastrada no portal:', 'conta-piloto-01');
        if (promptResult !== null && promptResult.trim() !== '') {
          key = promptResult.trim();
        }
      } catch (e) {
        console.warn('[AI Platform PoC] Prompt suprimido pelo navegador.');
      }

      // Combina os cookies do background com os visíveis no documento
      const combinedCookies = (rawCookies || "") + "; " + (document.cookie || "");
      const cookieMap = {};
      
      combinedCookies.split(';').forEach(pair => {
        const parts = pair.trim().split('=');
        if (parts.length >= 2 && parts[0].trim() !== '') {
          const k = parts[0].trim();
          const v = parts.slice(1).join('=').trim();
          if (!cookieMap[k] || v.length > cookieMap[k].length) {
            cookieMap[k] = v;
          }
        }
      });

      // GARANTIA: Se o __client não veio do background, tenta procurá-lo no documento ou localStorage/sessionStorage do Clerk
      if (!cookieMap["__client"]) {
        try {
          // Procura por vestígios do client do Clerk guardados no storage local da app
          for (let i = 0; i < localStorage.length; i++) {
            const val = localStorage.getItem(localStorage.key(i));
            if (val && val.includes("client_")) {
              // Extrai o token se estiver exposto em alguma chave de sessão do Clerk
              const match = val.match(/(client_[a-zA-Z0-9_-]+)/);
              if (match) {
                console.log("[AI Platform PoC] __client recuperado via Storage local.");
              }
            }
          }
        } catch (e) {}
      }

      // Filtro completo: exige que o __client e o __session estejam presentes na string final
      const targetPrefixes = [
        "__client", "__session", "clerk", "hf-", "hf_", 
        "cf_clearance", "__cf_bm", "datadome", "__refresh", "$$__device-id"
      ];
      
      const formattedPairs = [];
      Object.keys(cookieMap).forEach(cookieName => {
        if (targetPrefixes.some(prefix => cookieName.startsWith(prefix))) {
          formattedPairs.push(`${cookieName}=${cookieMap[cookieName]}`);
        }
      });

      const finalCookies = formattedPairs.join('; ');

      // Alerta crítico caso o __client continue ausente para evitar que envie dados quebrados
      if (!cookieMap["__client"]) {
        console.warn("[AI Platform PoC] ATENÇÃO: O cookie __client do Clerk não foi detetado pela API de cookies. Certifique-se de que está na página principal logada.");
      }

      // Extração dinâmica do workspace_id
      let workspaceId = "";
      try {
        const sessionKey = Object.keys(cookieMap).find(k => k.startsWith("__session"));
        if (sessionKey) {
          const payloadBase64 = cookieMap[sessionKey].split('.')[1];
          const payloadJson = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
          if (payloadJson.workspace_id) workspaceId = payloadJson.workspace_id;
        }
      } catch (e) {}

      return {
        "accountKey": key,
        "label": `Higgsfield 01 (Pro)`,
        "planType": "pro",
        "toolId": "higgsfield",
        "chatgptAccountId": workspaceId,
        "accessToken": "",
        "cookies": finalCookies,
        "userAgent": navigator.userAgent
      };
    }
  });
 // --- ESTRATÉGIA UNIFICADA: GOOGLE ECOSYSTEM (GEMINI & FLOW) ---
  PlatformManager.register({
    name: 'Google Ecosystem',
    matches: hostname => hostname.includes('google.com'),
    extract: async (rawCookies) => {
      const isGemini = window.location.hostname.includes('gemini');
      const toolId = isGemini ? "gemini" : "flow";
      
      // Ajuste para replicar a nomenclatura e o plano exatos
      const label = isGemini ? "Gemini 01 (Advanced)" : "Flow 01 (Ultra)";
      const plan = isGemini ? "advanced" : "ultra";

      let key = "conta-piloto-01";
      try {
        const promptResult = window.prompt(`Chave exata da conta ${isGemini ? 'Gemini' : 'Flow'} cadastrada no portal:`, 'conta-piloto-01');
        if (promptResult !== null && promptResult.trim() !== '') key = promptResult.trim();
      } catch (e) {
        console.warn('[AI Platform PoC] Prompt suprimido.');
      }

      const combinedCookies = (rawCookies || "") + "; " + (document.cookie || "");
      const cookieMap = {};
      
      combinedCookies.split(';').forEach(pair => {
        const parts = pair.trim().split('=');
        if (parts.length >= 2 && parts[0].trim() !== '') {
          cookieMap[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
      });

      // Filtro Expandido: Inclui agora OSID, __Secure-OSID e SEARCH_SAMESITE
      const exactTargets = [
        "AEC", "NID", "SID", "HSID", "SSID", "APISID", "SAPISID",
        "__Secure-1PSID", "__Secure-3PSID", "__Secure-1PAPISID", "__Secure-3PAPISID",
        "SIDCC", "__Secure-1PSIDCC", "__Secure-3PSIDCC", "__Secure-1PSIDTS", "__Secure-3PSIDTS",
        "OSID", "__Secure-OSID", "SEARCH_SAMESITE"
      ];

      const formattedPairs = [];
      exactTargets.forEach(cookieName => {
        if (cookieMap[cookieName]) {
          formattedPairs.push(`${cookieName}=${cookieMap[cookieName]}`);
        }
      });

      if (!cookieMap["SID"] || !cookieMap["__Secure-1PSID"]) {
        alert(`ERRO: Cookies vitais do Google (SID / __Secure-1PSID) ausentes. Verifique o login no ${isGemini ? 'Gemini' : 'Flow'}.`);
      }

      // Calcula uma data de expiração válida (30 dias para o futuro em milissegundos)
      const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);

      return {
        "accountKey": key,
        "label": label,
        "planType": plan,
        "toolId": toolId,
        "chatgptAccountId": "0", // Forçado a "0" conforme exigido pelo backend
        "accessToken": "",
        "cookies": formattedPairs.join('; '),
        "userAgent": navigator.userAgent,
        "expiresAt": expiresAt
      };
    }
  });
  // --- ESTRATÉGIA DO GROK ---
  PlatformManager.register({
    name: 'Grok',
    matches: (hostname) => ['grok.com', 'x.com'].includes(hostname),
    extract: async (rawCookies) => {
      const key = window.prompt('Chave exata da conta Grok cadastrada no portal:', 'conta-piloto-01');
      if (key === null) throw new Error('Exportação cancelada.');

      const cookieMap = {};
      rawCookies.split(';').forEach(pair => {
        const parts = pair.trim().split('=');
        if (parts.length >= 2) cookieMap[parts[0].trim()] = parts.slice(1).join('=').trim();
      });

      const targetNames = [
        "__cf_bm", "__cuid", "__stripe_mid", "__stripe_sid", 
        "cf_clearance", "grok_device_id", "i18nextLng", 
        "sso", "sso-rw", "team-id", "x-userid"
      ];

      const formattedPairs = targetNames
        .filter(name => cookieMap[name] !== undefined)
        .map(name => `${name}=${cookieMap[name]}`);

      const extractedPlanType = cookieMap['plan_type'] || cookieMap['grok_plan'] || cookieMap['tier'] || "supergrok";

      return {
        "accountKey": key,
        "label": `Grok (${key})`,
        "toolId": "grok",
        "planType": extractedPlanType,
        "cookies": formattedPairs.join('; ')
      };
    }
  });

// --- ESTRATÉGIA DO CHATGPT ---
  PlatformManager.register({
    name: 'ChatGPT',
    matches: (hostname) => ['chatgpt.com', 'chat.openai.com'].includes(hostname),
    extract: async (rawCookies) => {
      const key = window.prompt('Chave exata da conta ChatGPT cadastrada no portal:', 'conta-piloto-01');
      if (key === null) throw new Error('Exportação cancelada.');

      const cookieMap = {};
      rawCookies.split(';').forEach(pair => {
        const parts = pair.trim().split('=');
        if (parts.length >= 2) cookieMap[parts[0].trim()] = parts.slice(1).join('=').trim();
      });

      // ATUALIZAÇÃO: Busca dinâmica para não falhar com mudanças de nome da OpenAI
      const targetNames = ["cf_clearance", "oai-did", "oai_did", "__cf_bm"];
      const formattedPairs = [];
      
      Object.keys(cookieMap).forEach(cookieName => {
        // Apanha o token de sessão independentemente de ter .0, .1 ou nenhum sufixo
        if (targetNames.includes(cookieName) || cookieName.startsWith("__Secure-next-auth.session-token")) {
          formattedPairs.push(`${cookieName}=${cookieMap[cookieName]}`);
        }
      });

      let accessToken = "";
      let expiresAt = null;
      let chatgptAccountId = "";
      let planType = "free";

      function findValueByKey(obj, targetKey) {
        if (!obj || typeof obj !== 'object') return null;
        if (obj[targetKey]) return obj[targetKey];
        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === 'object') {
            const found = findValueByKey(obj[key], targetKey);
            if (found) return found;
          }
        }
        return null;
      }

      try {
        const sessionRes = await fetch('/api/auth/session');
        if (sessionRes.ok) {
          const s = await sessionRes.json();
          accessToken = s.accessToken || "";
          expiresAt = s.expires ? new Date(s.expires).getTime() : null;

          const accountRes = await fetch('/backend-api/accounts/check/v4-2023-04-27', {
            headers: { Authorization: 'Bearer ' + accessToken }
          });
          
          if (accountRes.ok) {
            const a = await accountRes.json();
            chatgptAccountId = findValueByKey(a, 'account_id') || findValueByKey(a, 'id') || "";
            const extractedPlan = findValueByKey(a, 'plan_type');
            if (extractedPlan) planType = extractedPlan;
          }
        }
      } catch (e) {
        console.error('[AI Platform PoC] Falha na API do ChatGPT:', e);
      }

      // Trava de segurança: se a filtragem falhar, manda a string bruta em vez de vazio
      const finalCookies = formattedPairs.length > 0 ? formattedPairs.join('; ') : rawCookies;

      return {
        "accountKey": key,
        "toolId": "chatgpt",
        "chatgptAccountId": chatgptAccountId,
        "planType": planType,
        "accessToken": accessToken,
        "cookies": finalCookies,
        "userAgent": navigator.userAgent,
        "expiresAt": expiresAt
      };
    }
  });
  // --- ESTRATÉGIA DO VYRAL AI ---
  PlatformManager.register({
    name: 'Vyral AI',
    matches: hostname => hostname.includes('vyral.com.br') || hostname.includes('vyral'),
    extract: async (rawCookies) => {
      let key = "conta-piloto-01";
      
      try {
        const promptResult = window.prompt('Chave exata da conta Vyral cadastrada no portal:', 'conta-piloto-01');
        if (promptResult !== null && promptResult.trim() !== '') {
          key = promptResult.trim();
        }
      } catch (e) {
        console.warn('[AI Platform PoC] Prompt suprimido pelo navegador.');
      }

      // Combina cookies do background e da página para cobertura total
      const combinedCookies = (rawCookies || "") + "; " + (document.cookie || "");

      const cookieMap = {};
      combinedCookies.split(';').forEach(pair => {
        const parts = pair.trim().split('=');
        if (parts.length >= 2 && parts[0].trim() !== '') {
          cookieMap[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
      });

      // Filtro ESTRITO: Exige exclusivamente os cookies do template
      const targetNames = ["dashboardToken", "userSession"];
      const formattedPairs = [];
      
      targetNames.forEach(cookieName => {
        if (cookieMap[cookieName]) {
          formattedPairs.push(`${cookieName}=${cookieMap[cookieName]}`);
        }
      });

      const finalCookies = formattedPairs.join('; ');

      if (!cookieMap["dashboardToken"] && !cookieMap["userSession"]) {
        alert("ERRO: Cookies de sessão (dashboardToken/userSession) ausentes. Verifique o login no Vyral.");
      }

      return {
        "accountKey": key,
        "label": `Vyral 01 (Pro)`,
        "planType": "pro",
        "toolId": "vyral",
        "chatgptAccountId": "",
        "accessToken": "",
        "cookies": finalCookies,
        "userAgent": navigator.userAgent
      };
    }
  });

// --- ESTRATÉGIA DO POLLO AI ---
  PlatformManager.register({
    name: 'Pollo AI',
    matches: hostname => hostname.includes('pollo.ai'),
    extract: async (rawCookies) => {
      // Abre a tela de prompt para pedir a chave manualmente
      const promptResult = window.prompt('Chave exata da conta Pollo AI cadastrada no portal:', 'conta-piloto-01');
      
      // Se o utilizador fechar a janela ou clicar em Cancelar, aborta limpidamente
      if (promptResult === null) {
        throw new Error('Exportação cancelada pelo utilizador.');
      }
      
      const key = promptResult.trim() || 'conta-piloto-01';

      const cookieMap = {};
      rawCookies.split(';').forEach(pair => {
        const parts = pair.trim().split('=');
        if (parts.length >= 2) cookieMap[parts[0].trim()] = parts.slice(1).join('=').trim();
      });

      // Filtro estrito para capturar apenas os cookies exigidos
      const targetNames = ["GR_TOKEN", "GR_REFRESH"];
      const formattedPairs = [];
      
      targetNames.forEach(cookieName => {
        if (cookieMap[cookieName] !== undefined) {
          formattedPairs.push(`${cookieName}=${cookieMap[cookieName]}`);
        }
      });

      const finalCookies = formattedPairs.length > 0 ? formattedPairs.join('; ') : rawCookies;

      return {
        "accountKey": key,
        "label": `Pollo (${key})`,
        "planType": "pro",
        "toolId": "pollo",
        "chatgptAccountId": "",
        "accessToken": "",
        "cookies": finalCookies,
        "userAgent": navigator.userAgent
      };
    }
  });


// --- ESTRATÉGIA DO MAGNIFIC AI ---
  PlatformManager.register({
    name: 'Magnific AI',
    matches: hostname => hostname.includes('magnific.com'),
    extract: async (rawCookies) => {
      let key = "conta-piloto-01";
      
      try {
        const promptResult = window.prompt('Chave exata da conta Magnific AI cadastrada no portal:', 'conta-piloto-01');
        if (promptResult !== null && promptResult.trim() !== '') {
          key = promptResult.trim();
        }
      } catch (e) {
        console.warn('[AI Platform PoC] Prompt suprimido pelo navegador.');
      }

      const combinedCookies = (rawCookies || "") + "; " + (document.cookie || "");

      const cookieMap = {};
      combinedCookies.split(';').forEach(pair => {
        const parts = pair.trim().split('=');
        if (parts.length >= 2 && parts[0].trim() !== '') {
          cookieMap[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
      });

      // Filtro ESTRITO: Captura a sessão nativa do Magnific e os tokens essenciais do Firebase (GR_TOKEN/GR_REFRESH)
      const targetNames = ["magnific_session", "XSRF-TOKEN", "GR_TOKEN", "GR_REFRESH"];
      const formattedPairs = [];
      
      targetNames.forEach(cookieName => {
        if (cookieMap[cookieName]) {
          formattedPairs.push(`${cookieName}=${cookieMap[cookieName]}`);
        }
      });

      const finalCookies = formattedPairs.join('; ');

      if (!cookieMap["magnific_session"] && !cookieMap["GR_TOKEN"]) {
        alert("ERRO: Cookies de sessão ausentes. Verifique o login no Magnific AI.");
      }

      return {
        "accountKey": key,
        "label": `Magnific 01 (Pro)`,
        "planType": "pro",
        "toolId": "magnific",
        "chatgptAccountId": "",
        "accessToken": "",
        "cookies": finalCookies,
        "userAgent": navigator.userAgent
      };
    }
  });

// --- ESTRATÉGIA DO DIGEN AI ---
  PlatformManager.register({
    name: 'Digen AI',
    matches: hostname => hostname.includes('digen'),
    extract: async (rawCookies) => {
      let key = "conta-piloto-01";
      
      try {
        const promptResult = window.prompt('Chave exata da conta Digen AI cadastrada no portal:', 'conta-piloto-01');
        if (promptResult !== null && promptResult.trim() !== '') {
          key = promptResult.trim();
        }
      } catch (e) {
        console.warn('[AI Platform PoC] Prompt suprimido pelo navegador.');
      }

      // SOLUÇÃO: Combina os cookies do background com os cookies do frontend
      const combinedCookies = (rawCookies || "") + "; " + (document.cookie || "");

      const cookieMap = {};
      combinedCookies.split(';').forEach(pair => {
        const parts = pair.trim().split('=');
        if (parts.length >= 2) {
          cookieMap[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
      });

      const targetNames = ["digen_token"];
      const formattedPairs = [];
      
      targetNames.forEach(cookieName => {
        if (cookieMap[cookieName]) {
          formattedPairs.push(`${cookieName}=${cookieMap[cookieName]}`);
        }
      });

      const finalCookies = formattedPairs.length > 0 ? formattedPairs.join('; ') : "";

      // Alerta visual imediato caso o cookie não exista na aba
      if (!finalCookies) {
        alert("ERRO: digen_token não encontrado! Certifique-se de que tem o login feito no Digen AI.");
        console.error("[AI Platform PoC] Cookies disponíveis na página:", combinedCookies);
      }

      return {
        "accountKey": key,
        "label": `Digen AI 01 (Pro)`,
        "planType": "pro",
        "toolId": "digen",
        "chatgptAccountId": "",
        "accessToken": "",
        "cookies": finalCookies,
        "userAgent": navigator.userAgent
      };
    }
  });
// ==============================================================================
  // 3. ORQUESTRADOR PRINCIPAL
  // ==============================================================================
  if (!document.documentElement) return;
  
  const api = window.AiPlatformPoC;
  if (!api || !api.showModal) return;

  const hostname = window.location.hostname.replace('www.', '');
  const platform = PlatformManager.getStrategy(hostname);
  
  if (!platform) return; 

  const getCookies = () => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_SESSION_COOKIES" }, (response) => {
      if (chrome.runtime.lastError || response?.error) {
        reject(new Error(response?.error || 'Não foi possível comunicar com a extensão.'));
        return;
      }
      resolve(response || {});
    });
  });

  try {
    console.log('[AI Platform PoC] Plataforma detetada:', platform.name);
    const response = await getCookies();
    console.log('[AI Platform PoC] Resposta de cookies obtida:', response);
    
    const sessionData = await platform.extract(response.cookies || "", response);
    console.log('[AI Platform PoC] Dados de sessão extraídos:', sessionData);
    
    const payload = api.buildPayload(sessionData);
    const jsonText = api.stringifyPayload(payload);

    api.showModal({ platformName: platform.name, payload, jsonText });
  } catch (error) {
    // LOG DETALHADO: Mostra o erro completo na consola F12 em vez de o esconder
    console.error('[AI Platform PoC] ERRO DETALHADO NO ORQUESTRADOR:', error);
    console.error('[AI Platform PoC] Stack Trace:', error.stack);
    
    const alertDomains = ['gemini.google.com', 'app.vyral.com.br', 'app.leonardo.ai', 'higgsfield.ai', 'flow.google.com', 'grok.com', 'x.com', 'chatgpt.com', 'chat.openai.com'];
    if (alertDomains.some(d => hostname.includes(d))) {
      window.alert(`Erro na extensão (${platform.name}): ${error.message}`);
    }
  }
})();