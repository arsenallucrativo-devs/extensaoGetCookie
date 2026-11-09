(() => {
  globalThis.AiPlatformPoC = globalThis.AiPlatformPoC || {};

  // ==============================================================================
  // 1. MAPEAMENTO E AUTO-DETECÇÃO INTELIGENTE DE PLATAFORMAS
  // ==============================================================================
  const KNOWN_PLATFORMS = {
    'chatgpt.com': { toolId: 'chatgpt', name: 'ChatGPT', plan: 'pro' },
    'chat.openai.com': { toolId: 'chatgpt', name: 'ChatGPT', plan: 'pro' },
    'gemini.google.com': { toolId: 'gemini', name: 'Google Gemini', plan: 'advanced' },
    'flow.google.com': { toolId: 'flow', name: 'Google Flow', plan: 'ultra' },
    'grok.com': { toolId: 'grok', name: 'Grok', plan: 'supergrok' },
    'x.com': { toolId: 'grok', name: 'Grok (X)', plan: 'supergrok' },
    'leonardo.ai': { toolId: 'leonardo', name: 'Leonardo AI', plan: 'maestro' },
    'app.leonardo.ai': { toolId: 'leonardo', name: 'Leonardo AI', plan: 'maestro' },
    'vyral.com.br': { toolId: 'vyral', name: 'Vyral IA', plan: 'pro' },
    'app.vyral.com.br': { toolId: 'vyral', name: 'Vyral IA', plan: 'pro' },
    'higgsfield.ai': { toolId: 'higgsfield', name: 'Higgsfield AI', plan: 'pro' },
    'pollo.ai': { toolId: 'pollo', name: 'Pollo AI', plan: 'pro' },
    'digen.ai': { toolId: 'digen', name: 'Digen AI', plan: 'pro' },
    'magnific.com': { toolId: 'magnific', name: 'Magnific AI', plan: 'pro' },
    'suno.com': { toolId: 'suno', name: 'Suno', plan: 'pro' },
    'suno.ai': { toolId: 'suno', name: 'Suno', plan: 'pro' },
    'geraviral.com.br': { toolId: 'geraviral', name: 'GeraViral', plan: 'pro' },
    'klingai.com': { toolId: 'kling', name: 'Kling AI', plan: 'pro' },
    'app.klingai.com': { toolId: 'kling', name: 'Kling AI', plan: 'pro' },
    'runwayml.com': { toolId: 'runway', name: 'Runway ML', plan: 'pro' },
    'app.runwayml.com': { toolId: 'runway', name: 'Runway ML', plan: 'pro' },
    'midjourney.com': { toolId: 'midjourney', name: 'Midjourney', plan: 'pro' },
    'ideogram.ai': { toolId: 'ideogram', name: 'Ideogram', plan: 'pro' },
    'pika.art': { toolId: 'pika', name: 'Pika', plan: 'pro' },
    'luma.ai': { toolId: 'luma', name: 'Luma Dream Machine', plan: 'pro' },
    'lumalabs.ai': { toolId: 'luma', name: 'Luma Labs', plan: 'pro' },
    'elevenlabs.io': { toolId: 'elevenlabs', name: 'ElevenLabs', plan: 'pro' },
    'udio.com': { toolId: 'udio', name: 'Udio', plan: 'pro' },
    'sora.com': { toolId: 'sora', name: 'Sora', plan: 'pro' },
    'cursor.com': { toolId: 'cursor', name: 'Cursor', plan: 'pro' }
  };

  function detectPlatform(hostname) {
    const rawHost = (hostname || (typeof window !== 'undefined' ? window.location?.hostname : '') || '').toLowerCase().replace(/^www\./, '');
    
    for (const [domain, info] of Object.entries(KNOWN_PLATFORMS)) {
      if (rawHost === domain || rawHost.endsWith('.' + domain)) {
        return { ...info, domain: rawHost };
      }
    }

    // Heurística de fallback para qualquer domínio novo
    const parts = rawHost.split('.').filter(p => !['app', 'chat', 'web', 'beta', 'login', 'portal', 'auth'].includes(p));
    let slug = parts[0] || 'ia-custom';
    slug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '');

    const name = slug.charAt(0).toUpperCase() + slug.slice(1);
    return {
      toolId: slug || 'ia-custom',
      name: name || 'Nova IA',
      plan: 'pro',
      domain: rawHost
    };
  }

  // ==============================================================================
  // 2. EXTRAÇÃO AVANÇADA DE TOKENS E STORAGE
  // ==============================================================================
  function extractStorageTokens() {
    let detectedToken = "";
    const foundTokens = [];

    const scan = (storage, sourceName) => {
      if (!storage) return;
      try {
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (!k) continue;
          const val = storage.getItem(k);
          if (!val || typeof val !== 'string') continue;

          // Detecta JWTs (formato eyJ...)
          const jwtMatch = val.match(/(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+)/);
          if (jwtMatch) {
            if (!detectedToken) detectedToken = jwtMatch[1];
            foundTokens.push({ key: k, value: jwtMatch[1], type: 'jwt', source: sourceName });
          }

          // Tokens Clerk
          if (k.includes('clerk') || val.includes('client_') || val.includes('sess_')) {
            foundTokens.push({ key: k, value: val, type: 'clerk', source: sourceName });
          }

          // Supabase Auth
          if (k.includes('supabase') || (k.includes('sb-') && k.includes('-auth-token'))) {
            try {
              const parsed = JSON.parse(val);
              const tok = parsed?.access_token || parsed?.currentSession?.access_token;
              if (tok) {
                if (!detectedToken) detectedToken = tok;
                foundTokens.push({ key: k, value: tok, type: 'supabase', source: sourceName });
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn('[AI Platform PoC] Falha ao ler storage:', e);
      }
    };

    if (typeof window !== 'undefined') {
      try { scan(window.localStorage, 'localStorage'); } catch {}
      try { scan(window.sessionStorage, 'sessionStorage'); } catch {}

      try {
        if (window.Clerk?.session?.getToken) {
          window.Clerk.session.getToken().then(tok => {
            if (tok && !detectedToken) detectedToken = tok;
          }).catch(() => {});
        }
      } catch {}
    }

    return { detectedToken, foundTokens };
  }

  // ==============================================================================
  // 3. CONSTRUTOR UNIVERSAL DO PAYLOAD DE SESSÃO
  // ==============================================================================
  function executeUniversalExtraction({ toolId, accountKey, planType, rawCookies }) {
    const docCookie = (typeof document !== 'undefined' ? document.cookie : "") || "";
    const combinedCookies = (rawCookies || "") + "; " + docCookie;
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

    const finalCookies = Object.entries(cookieMap)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    const { detectedToken } = extractStorageTokens();

    const cleanToolId = (toolId || 'ia-custom').toLowerCase().trim();
    const cleanKey = (accountKey || 'conta-piloto-01').trim();
    const cleanPlan = (planType || 'pro').toLowerCase().trim();
    const cleanLabel = `${cleanToolId.charAt(0).toUpperCase() + cleanToolId.slice(1)} 01 (${cleanPlan.charAt(0).toUpperCase() + cleanPlan.slice(1)})`;

    return {
      accountKey: cleanKey,
      label: cleanLabel,
      planType: cleanPlan,
      toolId: cleanToolId,
      chatgptAccountId: "",
      accessToken: detectedToken || "",
      cookies: finalCookies,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ""
    };
  }

  // ==============================================================================
  // 4. WIDGET VISUAL FLUTUANTE (Floating Action Button + Quick Capture Card)
  // ==============================================================================
  function initUniversalWidget({ getCookies, showModal, buildPayload, stringifyPayload, platformManager }) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    if (document.getElementById('arsenal-universal-fab-root')) return;

    const hostname = window.location.hostname.replace(/^www\./, '');
    const detected = detectPlatform(hostname);
    const existingStrategy = platformManager?.getStrategy ? platformManager.getStrategy(hostname) : null;

    const root = document.createElement('div');
    root.id = 'arsenal-universal-fab-root';
    Object.assign(root.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '2147483640',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });

    // 4.1. Botão Flutuante (FAB)
    const fabButton = document.createElement('button');
    fabButton.id = 'arsenal-fab-trigger';
    fabButton.innerHTML = '⚡ <span>Capturar Sessão</span>';
    Object.assign(fabButton.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      backgroundColor: '#09090b',
      color: '#10b981',
      border: '1.5px solid #10b981',
      borderRadius: '9999px',
      padding: '10px 18px',
      fontSize: '13px',
      fontWeight: '700',
      cursor: 'pointer',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 12px rgba(16,185,129,0.3)',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      outline: 'none',
      userSelect: 'none'
    });

    fabButton.onmouseover = () => {
      fabButton.style.transform = 'translateY(-2px) scale(1.03)';
      fabButton.style.boxShadow = '0 12px 28px rgba(0,0,0,0.6), 0 0 18px rgba(16,185,129,0.5)';
      fabButton.style.backgroundColor = '#18181b';
    };
    fabButton.onmouseout = () => {
      fabButton.style.transform = 'translateY(0) scale(1)';
      fabButton.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5), 0 0 12px rgba(16,185,129,0.3)';
      fabButton.style.backgroundColor = '#09090b';
    };

    // 4.2. Card Popover de Configuração
    const card = document.createElement('div');
    card.id = 'arsenal-fab-card';
    Object.assign(card.style, {
      display: 'none',
      position: 'absolute',
      bottom: '60px',
      right: '0',
      width: '340px',
      backgroundColor: '#18181b',
      color: '#f4f4f5',
      border: '1px solid #27272a',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.7), 0 0 1px 1px rgba(255,255,255,0.05)',
      flexDirection: 'column',
      gap: '14px',
      boxSizing: 'border-box'
    });

    // Top Header
    const cardHeader = document.createElement('div');
    Object.assign(cardHeader.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #27272a',
      paddingBottom: '10px'
    });

    const cardTitle = document.createElement('div');
    cardTitle.innerHTML = '<span style="color:#10b981;font-weight:bold;">⚡ Arsenal</span> <span style="font-size:12px;color:#a1a1aa;">Universal</span>';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    Object.assign(closeBtn.style, {
      background: 'transparent',
      border: 'none',
      color: '#71717a',
      fontSize: '16px',
      cursor: 'pointer',
      padding: '2px 6px',
      borderRadius: '4px'
    });
    closeBtn.onclick = () => { card.style.display = 'none'; };

    cardHeader.appendChild(cardTitle);
    cardHeader.appendChild(closeBtn);

    // Info Subtitle
    const cardDesc = document.createElement('div');
    cardDesc.style.fontSize = '12px';
    cardDesc.style.color = '#a1a1aa';
    cardDesc.innerText = `Site atual: ${hostname}`;

    // Field 1: Tool ID (Nome da IA)
    const fieldToolId = document.createElement('div');
    fieldToolId.innerHTML = `
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#e4e4e7;">
        Nome / Slug da IA (toolId):
      </label>
      <input id="arsenal-input-toolid" type="text" value="${detected.toolId}" 
        placeholder="ex: kling, runway, midjourney" 
        style="width:100%;box-sizing:border-box;padding:8px 10px;background:#09090b;border:1px solid #3f3f46;border-radius:6px;color:#fff;font-size:13px;outline:none;" />
    `;

    // Field 2: Account Key
    const fieldAccountKey = document.createElement('div');
    fieldAccountKey.innerHTML = `
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#e4e4e7;">
        Chave da Conta (accountKey):
      </label>
      <input id="arsenal-input-key" type="text" value="conta-piloto-01" 
        placeholder="ex: conta-piloto-01" 
        style="width:100%;box-sizing:border-box;padding:8px 10px;background:#09090b;border:1px solid #3f3f46;border-radius:6px;color:#fff;font-size:13px;outline:none;" />
    `;

    // Field 3: Plan Type
    const fieldPlan = document.createElement('div');
    fieldPlan.innerHTML = `
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#e4e4e7;">
        Plano da Ferramenta:
      </label>
      <select id="arsenal-select-plan" style="width:100%;box-sizing:border-box;padding:8px 10px;background:#09090b;border:1px solid #3f3f46;border-radius:6px;color:#fff;font-size:13px;outline:none;">
        <option value="pro" ${detected.plan === 'pro' ? 'selected' : ''}>Pro</option>
        <option value="advanced" ${detected.plan === 'advanced' ? 'selected' : ''}>Advanced</option>
        <option value="ultra" ${detected.plan === 'ultra' ? 'selected' : ''}>Ultra</option>
        <option value="maestro" ${detected.plan === 'maestro' ? 'selected' : ''}>Maestro</option>
        <option value="standard">Standard</option>
      </select>
    `;

    // Status Alert Container
    const statusBox = document.createElement('div');
    statusBox.id = 'arsenal-status-box';
    Object.assign(statusBox.style, {
      fontSize: '11px',
      color: '#10b981',
      display: 'none',
      padding: '6px 8px',
      backgroundColor: 'rgba(16,185,129,0.1)',
      border: '1px solid rgba(16,185,129,0.3)',
      borderRadius: '6px'
    });

    // Capture Action Button
    const captureBtn = document.createElement('button');
    captureBtn.innerText = '🚀 Capturar Sessão Agora';
    Object.assign(captureBtn.style, {
      width: '100%',
      padding: '11px',
      backgroundColor: '#10b981',
      color: '#09090b',
      border: 'none',
      borderRadius: '6px',
      fontWeight: 'bold',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'opacity 0.2s',
      marginTop: '4px'
    });

    captureBtn.onmouseover = () => { captureBtn.style.opacity = '0.9'; };
    captureBtn.onmouseout = () => { captureBtn.style.opacity = '1'; };

    captureBtn.onclick = async () => {
      const toolIdInput = document.getElementById('arsenal-input-toolid')?.value || detected.toolId;
      const keyInput = document.getElementById('arsenal-input-key')?.value || 'conta-piloto-01';
      const planSelect = document.getElementById('arsenal-select-plan')?.value || 'pro';

      captureBtn.disabled = true;
      captureBtn.innerText = '⏳ Extraindo cookies e tokens...';

      try {
        const response = await getCookies();
        const rawCookies = response?.cookies || "";
        
        let sessionData;
        // Se houver estratégia dedicada e o usuário não trocou o slug, usa a dedicada se preferir
        if (existingStrategy && toolIdInput === detected.toolId) {
          try {
            sessionData = await existingStrategy.extract(rawCookies, response);
          } catch (e) {
            console.warn('[AI Platform PoC] Estratégia dedicada falhou, usando extrator universal:', e);
            sessionData = executeUniversalExtraction({
              toolId: toolIdInput,
              accountKey: keyInput,
              planType: planSelect,
              rawCookies
            });
          }
        } else {
          sessionData = executeUniversalExtraction({
            toolId: toolIdInput,
            accountKey: keyInput,
            planType: planSelect,
            rawCookies
          });
        }

        const payload = buildPayload(sessionData);
        const jsonText = stringifyPayload(payload);

        card.style.display = 'none';
        showModal({
          platformName: detected.name || toolIdInput.toUpperCase(),
          payload,
          jsonText
        });
      } catch (err) {
        statusBox.style.display = 'block';
        statusBox.style.color = '#ef4444';
        statusBox.style.backgroundColor = 'rgba(239,68,68,0.1)';
        statusBox.style.borderColor = 'rgba(239,68,68,0.3)';
        statusBox.innerText = `Erro: ${err.message}`;
      } finally {
        captureBtn.disabled = false;
        captureBtn.innerText = '🚀 Capturar Sessão Agora';
      }
    };

    card.appendChild(cardHeader);
    card.appendChild(cardDesc);
    card.appendChild(fieldToolId);
    card.appendChild(fieldAccountKey);
    card.appendChild(fieldPlan);
    card.appendChild(statusBox);
    card.appendChild(captureBtn);

    fabButton.onclick = () => {
      card.style.display = (card.style.display === 'none' || !card.style.display) ? 'flex' : 'none';
      if (card.style.display === 'flex') {
        const { detectedToken } = extractStorageTokens();
        if (detectedToken) {
          statusBox.style.display = 'block';
          statusBox.style.color = '#10b981';
          statusBox.style.backgroundColor = 'rgba(16,185,129,0.1)';
          statusBox.style.borderColor = 'rgba(16,185,129,0.3)';
          statusBox.innerText = '✔ Token de autenticação detectado no storage local!';
        } else {
          statusBox.style.display = 'none';
        }
      }
    };

    root.appendChild(card);
    root.appendChild(fabButton);

    const mount = () => {
      if (document.body && !document.getElementById('arsenal-universal-fab-root')) {
        document.body.appendChild(root);
      }
    };

    if (document.body) {
      mount();
    } else {
      document.addEventListener('DOMContentLoaded', mount);
    }
  }

  // Exporta para o escopo global
  globalThis.AiPlatformPoC.detectPlatform = detectPlatform;
  globalThis.AiPlatformPoC.extractStorageTokens = extractStorageTokens;
  globalThis.AiPlatformPoC.executeUniversalExtraction = executeUniversalExtraction;
  globalThis.AiPlatformPoC.initUniversalWidget = initUniversalWidget;
})();
