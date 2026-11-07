chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_SESSION_COOKIES") {
    const urlObj = new URL(sender.tab.url);
    const hostname = urlObj.hostname;

   // --- BLOCO 1: BUSCA COMBINADA (Google e Higgsfield) ---
    if (hostname.includes('google.com') || hostname.includes('higgsfield.ai')) {
      
      let queries = [];
      
      if (hostname.includes('higgsfield.ai')) {
        // Cobre o domínio principal, super-domínio (Cloudflare/fp_ref) e o subdomínio do Clerk (__client)
        queries = [
          { url: sender.tab.url },
          { domain: "higgsfield.ai" },
          { domain: ".higgsfield.ai" },
          { url: "https://higgsfield.ai" },
          { url: "https://clerk.higgsfield.ai" },
          { domain: "clerk.higgsfield.ai" }
        ];
      } else if (hostname.includes('google.com')) {
        queries = [
          { url: sender.tab.url },
          { domain: "google.com" },
          { domain: ".google.com" }
        ];
      }

      // Executa as buscas em paralelo — sem storeId para máxima compatibilidade cross-browser
      Promise.all(queries.map(q => {
        return new Promise((resolve) => {
          chrome.cookies.getAll(q, (result) => {
            resolve(result || []);
          });
        });
      })).then((results) => {
        const allCookies = results.flat().filter(c => c);
        const uniqueMap = new Map();
        
        allCookies.forEach(c => {
          // Anti-overwrite: preserva o token de maior comprimento caso haja duplicados
          if (!uniqueMap.has(c.name) || c.value.length > uniqueMap.get(c.name).length) {
            uniqueMap.set(c.name, c.value);
          }
        });

        const cookieString = Array.from(uniqueMap.entries())
          .map(([name, value]) => `${name}=${value}`)
          .join('; ');

        sendResponse({ cookies: cookieString });
      });

      return true; 
    }
    // --- BLOCO 2: MAPEAMENTO PADRÃO ---
    let query = {};
    if (hostname.includes('x.com')) { query = { domain: "x.com" };
    } else if (hostname.includes('grok.com')) { query = { domain: "grok.com" };
    } else if (hostname.includes('chatgpt.com')) { query = { domain: "chatgpt.com" };
    } else if (hostname.includes('openai.com')) { query = { domain: "openai.com" };
    } else if (hostname.includes('leonardo.ai')) { query = { url: sender.tab.url };
    } else if (hostname.includes('pollo.ai')) { query = { domain: "pollo.ai" };
    } else if (hostname.includes('digen')) { query = { url: sender.tab.url };
    } else if (hostname.includes('magnific.com')) {
      // Busca combinada para o Magnific + Freepik (empresa mãe):
      // GR_*, _fc*, UID, FP_MBL_NEW, AI_MBL, pkce_verifier, ak_bmsc, etc.
      // são definidos no domínio freepik.com e compartilhados com magnific.com
      const magQueries = [
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
      if (sender.tab.cookieStoreId) magQueries.forEach(q => { q.storeId = sender.tab.cookieStoreId; });

      Promise.all(magQueries.map(q =>
        new Promise(resolve => chrome.cookies.getAll(q, result => resolve(result || [])))
      )).then(results => {
        const allCookies = results.flat().filter(c => c);
        const uniqueMap = new Map();
        allCookies.forEach(c => {
          if (!uniqueMap.has(c.name) || c.value.length > uniqueMap.get(c.name).length) {
            uniqueMap.set(c.name, c.value);
          }
        });
        const cookieString = Array.from(uniqueMap.entries()).map(([n, v]) => `${n}=${v}`).join('; ');
        sendResponse({ cookies: cookieString });
      });
      return true;
    } else if (hostname.includes('suno.com') || hostname.includes('suno.ai')) {
      // Suno usa Clerk: busca nos domínios raiz e subdomínio do Clerk para capturar __session e __client_uat
      const sunoQueries = [
        { url: sender.tab.url },
        { domain: "suno.com" },
        { domain: ".suno.com" },
        { domain: "suno.ai" },
        { domain: ".suno.ai" },
        { domain: "clerk.suno.com" },
        { domain: ".clerk.suno.com" }
      ];
      if (sender.tab.cookieStoreId) sunoQueries.forEach(q => { q.storeId = sender.tab.cookieStoreId; });

      Promise.all(sunoQueries.map(q =>
        new Promise(resolve => chrome.cookies.getAll(q, result => resolve(result || [])))
      )).then(results => {
        const allCookies = results.flat().filter(c => c);
        const uniqueMap = new Map();
        allCookies.forEach(c => {
          if (!uniqueMap.has(c.name) || c.value.length > uniqueMap.get(c.name).length) {
            uniqueMap.set(c.name, c.value);
          }
        });
        const cookieString = Array.from(uniqueMap.entries()).map(([n, v]) => `${n}=${v}`).join('; ');
        sendResponse({ cookies: cookieString });
      });
      return true;
    } else if (hostname.includes('vyral')) { query = { url: sender.tab.url };
    } else { query = { url: sender.tab.url }; }

    if (sender.tab.cookieStoreId) query.storeId = sender.tab.cookieStoreId;

    chrome.cookies.getAll(query, (cookies) => {
      if (chrome.runtime.lastError) {
         sendResponse({ cookies: "", error: chrome.runtime.lastError.message });
         return;
      }
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      sendResponse({ cookies: cookieString });
    });
    
    return true; 
  }
});