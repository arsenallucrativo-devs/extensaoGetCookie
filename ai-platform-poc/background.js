chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_SESSION_COOKIES") {
    const urlObj = new URL(sender.tab.url);
    const hostname = urlObj.hostname;

    // --- BLOCO 1: BUSCA COMBINADA (Google e Higgsfield) ---
    if (hostname.includes('google.com') || hostname.includes('higgsfield.ai')) {
      const storeId = sender.tab.cookieStoreId;
      
      // Define as URLs alvo (força a busca na raiz, na aba ativa e na API do Clerk)
      let endpoints = [sender.tab.url];
      if (hostname.includes('higgsfield.ai')) {
        endpoints.push("https://higgsfield.ai", "https://clerk.higgsfield.ai");
      } else if (hostname.includes('google.com')) {
        endpoints.push("https://google.com");
      }

      // Executa as buscas em paralelo
      Promise.all(endpoints.map(url => {
        return new Promise((resolve) => {
          const query = { url: url };
          if (storeId) query.storeId = storeId;
          chrome.cookies.getAll(query, resolve);
        });
      })).then((results) => {
        const allCookies = results.flat().filter(c => c);
        const uniqueMap = new Map();
        
        allCookies.forEach(c => {
          // Proteção anti-overwrite: se houver cookies duplicados, guarda o que tem o token maior
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
    } else if (hostname.includes('magnific.com')) { query = { domain: "magnific.com" };
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