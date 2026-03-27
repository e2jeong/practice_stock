document.addEventListener("DOMContentLoaded", () => {
    // State
    let transactions = JSON.parse(localStorage.getItem('stock_transactions')) || [];
    let apiKey = localStorage.getItem('gemini_api_key') || "";

    // DOM Elements
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    
    // Forms
    const transactionForm = document.getElementById('transactionForm');
    
    // Table body and footer
    const portfolioTableBody = document.querySelector('#portfolioTable tbody');
    const totalInvestmentVal = document.getElementById('totalInvestmentVal');

    // Chat
    const chatWindow = document.getElementById('chatWindow');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');

    // Initialization
    if (apiKey) {
        apiKeyInput.value = apiKey;
    }
    renderTable();

    // Event Listeners
    saveApiKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('gemini_api_key', key);
            apiKey = key;
            alert('API Key saved securely in local storage.');
        } else {
            alert('Please enter a valid API key.');
        }
    });

    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const sector = document.getElementById('sector').value.trim();
        const date = document.getElementById('date').value;
        const price = parseFloat(document.getElementById('price').value);
        const quantity = parseInt(document.getElementById('quantity').value, 10);

        const newTx = {
            id: Date.now().toString(),
            sector,
            date,
            price,
            quantity
        };

        transactions.push(newTx);
        saveTransactions();
        renderTable();
        transactionForm.reset();
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = chatInput.value.trim();
        if (!msg) return;

        // Append user message
        appendMessage(msg, 'user');
        chatInput.value = "";

        // Check for API key
        if (!apiKey) {
            appendMessage("Please configure your Gemini API Key in the header first to use this feature.", 'ai');
            return;
        }

        // Prepare context data
        const portfolioData = JSON.stringify(transactions);
        const promptContext = `
            You are a helpful AI investment counselor and portfolio analyst.
            The user has provided the following stock transaction history (in JSON):
            ${portfolioData}
            
            Based on this provided portfolio data, answer the user's query:
            User Query: ${msg}
            
            Keep your response concise, professional, structured, and insightful. Use HTML formatting like <b>, <br>, <ul> if appropriate. Do not use Markdown, strictly use HTML elements if formatting is needed.
        `;

        try {
            // Added loading indicator (optional but good for UX)
            const loadingMsgId = appendMessage("Thinking...", 'ai');

            // API Call logic using gemini-3-flash-preview
            // Using standard fetch structure
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: promptContext }
                            ]
                        }
                    ]
                })
            });

            const data = await response.json();

            // Removing loading message
            removeMessage(loadingMsgId);

            if (data.error) {
                appendMessage(`API Error: ${data.error.message}`, 'ai');
            } else if (data.candidates && data.candidates.length > 0) {
                const aiMsg = data.candidates[0].content.parts[0].text;
                appendMessage(aiMsg, 'ai');
            } else {
                appendMessage("Received an unexpected empty response from the AI.", 'ai');
            }

        } catch (error) {
            console.error("Chat API Error:", error);
            appendMessage("An error occurred while communicating with the AI. Please verify your connection and API key.", 'ai');
        }
    });

    // Helper functions
    function saveTransactions() {
        localStorage.setItem('stock_transactions', JSON.stringify(transactions));
    }

    function renderTable() {
        portfolioTableBody.innerHTML = "";
        let totalVal = 0;

        if (transactions.length === 0) {
            portfolioTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No transactions logged yet.</td></tr>`;
            totalInvestmentVal.textContent = "$0.00";
            return;
        }

        transactions.forEach(tx => {
            const tr = document.createElement('tr');
            const totalRowVal = tx.price * tx.quantity;
            totalVal += totalRowVal;

            tr.innerHTML = `
                <td>${tx.sector}</td>
                <td>${tx.date}</td>
                <td>$${tx.price.toFixed(2)}</td>
                <td>${tx.quantity}</td>
                <td>$${totalRowVal.toFixed(2)}</td>
                <td><button class="btn danger" onclick="deleteTx('${tx.id}')">Del</button></td>
            `;
            portfolioTableBody.appendChild(tr);
        });

        totalInvestmentVal.textContent = `$${totalVal.toFixed(2)}`;
    }

    // Expose delete to window as it's an inline handler
    window.deleteTx = function(id) {
        if(confirm("Are you sure you want to delete this record?")) {
            transactions = transactions.filter(t => t.id !== id);
            saveTransactions();
            renderTable();
        }
    }

    function appendMessage(text, sender) {
        const id = 'msg_' + Date.now();
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        msgDiv.id = id;
        
        const bubble = document.createElement('div');
        bubble.className = "bubble";
        bubble.innerHTML = text; // Safe here since it's a controlled prompt/personal app, but note security implications of innerHTML in prod.
        
        msgDiv.appendChild(bubble);
        chatWindow.appendChild(msgDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        
        return id;
    }

    function removeMessage(id) {
        const msgList = document.getElementById(id);
        if (msgList) msgList.remove();
    }
});
