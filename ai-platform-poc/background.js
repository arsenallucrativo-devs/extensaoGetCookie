chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_SESSION_COOKIES") {
    const urlObj = new URL(sender.tab.url);
    const hostname = urlObj.hostname;
    const storeId = sender.tab.cookieStoreId;

    // --- BLOCO 1: Módulos Nativos com Collectors Dedicados ---
    const poc = globalThis.AiPlatformPoC || {};
    const collector = { 
      'gemini.google.com': poc.Gemini,
      'app.vyral.com.br': poc.Vyral 
    }[hostname];

    if (collector && typeof collector.collect === 'function') {
      const query = { url: sender.tab.url };
      if (storeId) query.storeId = storeId;
      
      chrome.cookies.getAll(query, (cookies) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message || 'Não foi possível ler cookies.' });
          return;
        }
        try {
          sendResponse(collector.collect(cookies, sender.tab.url));
        } catch (error) { 
          sendResponse({ error: error.message }); 
        }
      });
      return true; 
    }

    // --- BLOCO 2: BUSCAS ESPECÍFICAS POR PLATAFORMA ---
    let queries = [];

    if (hostname.includes('google.com')) {
      queries = [
        { url: sender.tab.url },
        { domain: "google.com" },
        { domain: ".google.com" }
      ];
    } else if (hostname.includes('higgsfield.ai')) {
      queries = [
        { url: sender.tab.url },
        { domain: "higgsfield.ai" },
        { domain: ".higgsfield.ai" },
        { url: "https://higgsfield.ai" },
        { url: "https://clerk.higgsfield.ai" },
        { domain: "clerk.higgsfield.ai" }
      ];
    } else if (hostname.includes('magnific.com')) {
      queries = [
        { url: sender.tab.url },
        { domain: "magnific.com" },
        { domain: ".magnific.com" },
        { url: "https://magnific.com" },
        { url: "https://www.magnific.com" },
        { domain: "freepik.com" },
        { domain: ".freepik.com" },
        { url: "https://freepik.com" },
        { url: "https://www.freepik.com" },
        { domain: "accounts.freepik.com" },
        { domain: ".accounts.freepik.com" }
      ];
    } else if (hostname.includes('suno.com') || hostname.includes('suno.ai')) {
      queries = [
        { url: sender.tab.url },
        { domain: "suno.com" },
        { domain: ".suno.com" },
        { domain: "suno.ai" },
        { domain: ".suno.ai" },
        { domain: "clerk.suno.com" },
        { domain: ".clerk.suno.com" }
      ];
    } else if (hostname.includes('x.com')) {
      queries = [{ domain: "x.com" }];
    } else if (hostname.includes('grok.com')) {
      queries = [{ domain: "grok.com" }];
    } else if (hostname.includes('chatgpt.com')) {
      queries = [{ domain: "chatgpt.com" }];
    } else if (hostname.includes('openai.com')) {
      queries = [{ domain: "openai.com" }];
    } else if (hostname.includes('leonardo.ai')) {
      queries = [{ url: sender.tab.url }];
    } else if (hostname.includes('pollo.ai')) {
      queries = [{ domain: "pollo.ai" }];
    } else if (hostname.includes('digen')) {
      queries = [{ url: sender.tab.url }];
    } else if (hostname.includes('geraviral')) {
      queries = [{ domain: "geraviral.com.br" }];
    } else if (hostname.includes('vyral')) {
      queries = [{ url: sender.tab.url }];
    } else {
      // --- BLOCO 3: CAPTURA UNIVERSAL INTELIGENTE (Qualquer IA / Site) ---
      const hostParts = hostname.replace(/^www\./, '').split('.');
      const rootDomain = hostParts.length >= 2 ? hostParts.slice(-2).join('.') : hostname;

      queries = [
        { url: sender.tab.url },
        { domain: hostname },
        { domain: `.${hostname}` }
      ];

      if (rootDomain && rootDomain !== hostname) {
        queries.push({ domain: rootDomain });
        queries.push({ domain: `.${rootDomain}` });
        queries.push({ domain: `clerk.${rootDomain}` });
        queries.push({ domain: `auth.${rootDomain}` });
        queries.push({ domain: `accounts.${rootDomain}` });
      }
    }

    if (storeId) {
      queries.forEach(q => { q.storeId = storeId; });
    }

    // Se houver apenas 1 query, executa diretamente para evitar microtask delay desnecessário
    if (queries.length === 1) {
      chrome.cookies.getAll(queries[0], (cookies) => {
        if (chrome.runtime.lastError) {
          sendResponse({ cookies: "", error: chrome.runtime.lastError.message });
          return;
        }
        const cookieString = (cookies || []).map(c => `${c.name}=${c.value}`).join('; ');
        sendResponse({ cookies: cookieString });
      });
      return true;
    }

    Promise.all(queries.map(q => {
      return new Promise(resolve => {
        chrome.cookies.getAll(q, result => {
          if (chrome.runtime.lastError) {
            resolve([]);
          } else {
            resolve(result || []);
          }
        });
      });
    })).then(results => {
      const allCookies = results.flat().filter(Boolean);
      const uniqueMap = new Map();

      allCookies.forEach(c => {
        if (!uniqueMap.has(c.name) || ((c.value || '').length > (uniqueMap.get(c.name) || '').length)) {
          uniqueMap.set(c.name, c.value || '');
        }
      });

      const cookieString = Array.from(uniqueMap.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');

      sendResponse({ cookies: cookieString, totalCount: uniqueMap.size });
    }).catch(err => {
      sendResponse({ error: err.message, cookies: "" });
    });

    return true; 
  }
});
