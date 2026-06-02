/* ==========================================================================
   ParkFlow Application Logic (Multi-Yard / No Fee) - app.js
   ========================================================================== */

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, function(tag) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Login Logic ---
    const loginOverlay = document.getElementById('login-overlay');
    const mainApp = document.getElementById('main-app');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error-msg');
    
    if (sessionStorage.getItem('parkflow_logged_in') === 'true') {
        if (loginOverlay) loginOverlay.style.display = 'none';
        if (mainApp) mainApp.style.display = '';
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('login-username').value.trim();
            const pass = document.getElementById('login-password').value.trim();
            
            if (user === 'diegomo' && pass === 'a10a20a30bb') {
                sessionStorage.setItem('parkflow_logged_in', 'true');
                loginOverlay.style.display = 'none';
                mainApp.style.display = '';
            } else {
                loginError.style.display = 'block';
            }
        });
    }

    // --- Mobile Menu Logic ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');
    const menuItems = document.querySelectorAll('.menu-item');

    function toggleMobileMenu() {
        if (sidebar && sidebarOverlay) {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('show');
        }
    }

    function closeMobileMenu() {
        if (sidebar && sidebarOverlay) {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('show');
        }
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeMobileMenu);
    }

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMobileMenu();
            }
        });
    });

    // --- State Variables ---
    let activeVehicles = [];
    let history = [];
    let configs = {
        capRoberto: 15,
        capTerreno: 25,
        capBarracao: 10
    };
    
    let activeYardFilter = 'all'; // 'all', 'Patio Roberto', 'Patio Terreno', 'Patio Barracao'
    let currentCheckoutVehicle = null;
    let currentTransferVehicle = null;
    let currentLeilaoVehicle = null;
    let registeredBanks = ['Volkswagen', 'Mercado Pago', 'GM', 'C6 Bank'];
    let auctionHistory = [];
    let shippedHistory = [];
    let shippedDeleteMode = false;
    
    // Supabase State
    let supabaseClient = null;
    let isSupabaseActive = false;

    // --- DOM Elements Caching ---
    const elements = {
        // Navigation Buttons
        btnDashboard: document.getElementById('btn-dashboard'),
        btnHistoryTab: document.getElementById('btn-historico-aba'),
        btnSettings: document.getElementById('btn-configuracoes'),
        
        // Sections
        secDashboard: document.getElementById('section-dashboard'),
        secHistory: document.getElementById('section-historico'),
        secSettings: document.getElementById('section-configuracoes'),
        
        // Page Titles
        pageTitle: document.getElementById('page-title'),
        pageSubtitle: document.getElementById('page-subtitle'),
        
        // Live Clock
        liveClock: document.getElementById('live-clock'),
        
        // Dashboard Yard Active Counts & Vagas Labels
        statActiveRoberto: document.getElementById('stat-active-roberto'),
        statActiveTerreno: document.getElementById('stat-active-terreno'),
        statActiveBarracao: document.getElementById('stat-active-barracao'),
        statActiveTotal: document.getElementById('stat-active-total'),
        
        capLabelRoberto: document.getElementById('cap-label-roberto'),
        capLabelTerreno: document.getElementById('cap-label-terreno'),
        capLabelBarracao: document.getElementById('cap-label-barracao'),
        
        // Forms & Inputs
        formEntry: document.getElementById('form-entry'),
        inputPlaca: document.getElementById('input-placa'),
        inputModelo: document.getElementById('input-modelo'),
        selectPatio: document.getElementById('select-patio'),
        inputEntrada: document.getElementById('input-entrada'),
        btnSetNow: document.getElementById('btn-set-now'),
        selectBanco: document.getElementById('select-banco'),
        formAddBank: document.getElementById('form-add-bank'),
        inputNewBank: document.getElementById('input-new-bank'),
        registeredBanksList: document.getElementById('registered-banks-list'),
        
        // Tables, Searches & Tabs
        searchActive: document.getElementById('search-active'),
        tbodyActive: document.getElementById('tbody-active'),
        yardTabs: document.querySelectorAll('.yard-tab'),
        searchHistory: document.getElementById('search-history'),
        tbodyHistory: document.getElementById('tbody-history'),
        
        // Configs Form Inputs
        configCapRoberto: document.getElementById('config-cap-roberto'),
        configCapTerreno: document.getElementById('config-cap-terreno'),
        configCapBarracao: document.getElementById('config-cap-barracao'),
        btnSaveConfigs: document.getElementById('btn-save-configs'),
        btnClearHistory: document.getElementById('btn-clear-history'),
        btnExportCsv: document.getElementById('btn-export-csv'),
        
        // Simplified Exit/Checkout Modal Elements
        modalCheckout: document.getElementById('modal-checkout'),
        modalCloseBtn: document.getElementById('btn-close-modal'),
        modalPlateBadge: document.getElementById('modal-plate-badge'),
        modalModelBadge: document.getElementById('modal-model-badge'),
        modalTimeEntry: document.getElementById('modal-time-entry'),
        modalTimeExit: document.getElementById('modal-time-exit'),
        btnModalSetNow: document.getElementById('btn-modal-set-now'),
        modalRegisteredYard: document.getElementById('modal-registered-yard'),
        modalRegisteredBank: document.getElementById('modal-registered-bank'),
        modalDuration: document.getElementById('modal-duration'),
        btnCancelCheckout: document.getElementById('btn-cancel-checkout'),
        btnConfirmCheckout: document.getElementById('btn-confirm-checkout'),

        // Transfer Yard Modal Elements
        modalTransfer: document.getElementById('modal-transfer'),
        modalCloseTransferBtn: document.getElementById('btn-close-transfer'),
        modalTransferPlate: document.getElementById('modal-transfer-plate'),
        modalTransferModel: document.getElementById('modal-transfer-model'),
        modalTransferCurrentYard: document.getElementById('modal-transfer-current-yard'),
        modalSelectTransferYard: document.getElementById('modal-select-transfer-yard'),
        btnCancelTransfer: document.getElementById('btn-cancel-transfer'),
        btnConfirmTransfer: document.getElementById('btn-confirm-transfer'),
        
        // Edit Bank Modal Elements
        modalEditBank: document.getElementById('modal-edit-bank'),
        btnCloseEditBankModal: document.getElementById('btn-close-edit-bank-modal'),
        modalEditBankPlateBadge: document.getElementById('modal-edit-bank-plate-badge'),
        modalEditBankModelBadge: document.getElementById('modal-edit-bank-model-badge'),
        selectEditBank: document.getElementById('select-edit-bank'),
        btnCancelEditBank: document.getElementById('btn-cancel-edit-bank'),
        btnConfirmEditBank: document.getElementById('btn-confirm-edit-bank'),

        // Checklist Print Elements
        modalChecklistPrint: document.getElementById('modal-checklist-print'),
        btnCloseChecklistModal: document.getElementById('btn-close-checklist-modal'),
        btnPrintChecklist: document.getElementById('btn-print-checklist'),
        
        // Fechamento Leilão Elements
        btnLeilaoTab: document.getElementById('btn-leilao-aba'),
        secLeilao: document.getElementById('section-leilao'),
        searchLeilao: document.getElementById('search-leilao'),
        tbodyLeilao: document.getElementById('tbody-leilao'),
        btnExportLeilaoCsv: document.getElementById('btn-export-leilao-csv'),
        btnClearLeilao: document.getElementById('btn-clear-leilao'),

        // Shipped / Embarcados Elements
        btnShippedTab: document.getElementById('btn-embarcados-aba'),
        secShipped: document.getElementById('section-embarcados'),
        searchShipped: document.getElementById('search-embarcados'),
        tbodyShipped: document.getElementById('tbody-embarcados'),
        shippedAccordionTitle: document.getElementById('shipped-accordion-title'),
        shippedAccordionBadge: document.getElementById('shipped-accordion-badge'),
        shippedAccordionRevenue: document.getElementById('shipped-accordion-revenue'),
        btnExportShippedCsv: document.getElementById('btn-export-embarcados-csv'),
        btnTriggerDeleteShipped: document.getElementById('btn-trigger-delete-shipped'),
        btnCancelDeleteShipped: document.getElementById('btn-cancel-delete-shipped'),
        btnClearShipped: document.getElementById('btn-clear-embarcados'),

        // Auction / Leilão Checkout Modal Elements
        modalLeilaoCheckout: document.getElementById('modal-leilao-checkout'),
        modalCloseLeilaoBtn: document.getElementById('btn-close-leilao-modal'),
        modalLeilaoPlateBadge: document.getElementById('modal-leilao-plate-badge'),
        modalLeilaoModelBadge: document.getElementById('modal-leilao-model-badge'),
        modalLeilaoRegisteredYard: document.getElementById('modal-leilao-registered-yard'),
        modalLeilaoRegisteredBank: document.getElementById('modal-leilao-registered-bank'),
        modalLeilaoTimeEntry: document.getElementById('modal-leilao-time-entry'),
        modalLeilaoTimeExit: document.getElementById('modal-leilao-time-exit'),
        btnModalLeilaoSetNow: document.getElementById('btn-modal-leilao-set-now'),
        inputLeilaoTransi: document.getElementById('input-leilao-transi'),
        inputLeilaoEs: document.getElementById('input-leilao-es'),
        inputLeilaoExtras: document.getElementById('input-leilao-extras'),
        inputLeilaoOrigem: document.getElementById('input-leilao-origem'),
        inputLeilaoDestino: document.getElementById('input-leilao-destino'),
        labelLeilaoDiarias: document.getElementById('label-leilao-diarias'),
        labelLeilaoTotalEstadias: document.getElementById('label-leilao-total-estadias'),
        labelLeilaoTotalGeral: document.getElementById('label-leilao-total-geral'),
        btnCancelLeilao: document.getElementById('btn-cancel-leilao'),
        btnConfirmLeilao: document.getElementById('btn-confirm-leilao'),
        
        // Backup / Lembrete Elements
        backupReminderBanner: document.getElementById('backup-reminder-banner'),
        btnBackupNowBanner: document.getElementById('btn-backup-now-banner'),
        backupLastDateLabel: document.getElementById('backup-last-date-label'),
        btnCreateBackup: document.getElementById('btn-create-backup'),
        inputBackupFile: document.getElementById('input-backup-file'),
        btnTriggerUploadFile: document.getElementById('btn-trigger-upload-file'),
        btnRestoreBackup: document.getElementById('btn-restore-backup'),
        uploadFileNameHint: document.getElementById('upload-file-name-hint'),

        // CSV Import Elements
        inputImportCsv: document.getElementById('input-import-csv'),
        btnTriggerUploadCsv: document.getElementById('btn-trigger-upload-csv'),
        btnConfirmImportCsv: document.getElementById('btn-confirm-import-csv'),
        uploadCsvNameHint: document.getElementById('upload-csv-name-hint'),
        filterShippedMonth: document.getElementById('filter-embarcados-mes'),

        // Fast Active Import Elements
        cardImportAtivos: document.getElementById('card-import-ativos'),
        selectImportPatio: document.getElementById('select-import-patio'),
        inputImportAtivosCsv: document.getElementById('input-import-ativos-csv'),
        btnTriggerUploadAtivosCsv: document.getElementById('btn-trigger-upload-ativos-csv'),
        btnConfirmImportAtivosCsv: document.getElementById('btn-confirm-import-ativos-csv'),
        uploadAtivosCsvNameHint: document.getElementById('upload-ativos-csv-name-hint'),
        btnHideImportCard: document.getElementById('btn-hide-import-card'),

        // Toast Container
        toastContainer: document.getElementById('toast-container'),

        // Supabase Elements
        supabaseStatusBadge: document.getElementById('supabase-status-badge'),
        inputSupabaseUrl: document.getElementById('input-supabase-url'),
        inputSupabaseKey: document.getElementById('input-supabase-key'),
        btnSaveSupabase: document.getElementById('btn-save-supabase'),
        btnDisconnectSupabase: document.getElementById('btn-disconnect-supabase'),
        btnToggleSqlAccordion: document.getElementById('btn-toggle-sql-accordion'),
        sqlAccordionArrow: document.getElementById('sql-accordion-arrow'),
        sqlAccordionContent: document.getElementById('sql-accordion-content'),
        btnCopySql: document.getElementById('btn-copy-sql')
    };

    // --- Initialization ---
    async function init() {
        await initSupabaseClient();
        await loadDataFromStorage();
        setupEventListeners();
        startLiveClock();
        setCurrentTimeInInput();
        populateBankDropdown();
        renderRegisteredBanksList();
        renderDashboard();
        renderHistory();
        renderLeilaoTable();
        renderShippedTable();
        loadConfigsToInputs();
        
        // Inicializar status de Backup
        checkBackupReminder();
        updateBackupLastDateLabel();
    }

    // --- Local Storage Management ---
    // --- Local Storage & Supabase Cloud Management ---
    async function loadDataFromStorage() {
        if (isSupabaseActive) {
            try {
                // 1. Configs
                const { data: dbConfigs, error: errConfigs } = await supabaseClient.from('configs_yards').select('*');
                if (!errConfigs && dbConfigs && dbConfigs.length > 0) {
                    dbConfigs.forEach(item => {
                        if (item.id !== '__proto__') configs[item.id] = item.value;
                    });
                }
                
                // 2. Bancos
                const { data: dbBanks, error: errBanks } = await supabaseClient.from('registered_banks').select('*');
                if (!errBanks && dbBanks && dbBanks.length > 0) {
                    registeredBanks = dbBanks.map(item => item.name);
                }
                
                // 3. Ativos
                const { data: dbActive, error: errActive } = await supabaseClient.from('active_yards').select('*');
                if (!errActive && dbActive) {
                    activeVehicles = dbActive;
                }
                
                // 4. Histórico de saídas comuns
                const { data: dbHistory, error: errHistory } = await supabaseClient.from('history_yards').select('*');
                if (!errHistory && dbHistory) {
                    history = dbHistory;
                }
                
                // 5. Lote Leilão
                const { data: dbAuction, error: errAuction } = await supabaseClient.from('auction_history').select('*');
                if (!errAuction && dbAuction) {
                    auctionHistory = dbAuction;
                }
                
                // 6. Embarcados Leilão
                const { data: dbShipped, error: errShipped } = await supabaseClient.from('shipped_history').select('*');
                if (!errShipped && dbShipped) {
                    shippedHistory = dbShipped;
                }
                
                // Limpar placas legadas importadas ou em cache com hífens na nuvem se houver
                let needsActiveSync = false;
                let needsAuctionSync = false;
                let needsShippedSync = false;
                
                activeVehicles.forEach(car => {
                    const cleaned = formatPlateForDisplay(car.plate);
                    if (car.plate !== cleaned) {
                        car.plate = cleaned;
                        needsActiveSync = true;
                    }
                });
                
                history.forEach(car => {
                    const cleaned = formatPlateForDisplay(car.plate);
                    if (car.plate !== cleaned) {
                        car.plate = cleaned;
                        needsActiveSync = true;
                    }
                });
                
                auctionHistory.forEach(car => {
                    const cleaned = formatPlateForDisplay(car.plate);
                    if (car.plate !== cleaned) {
                        car.plate = cleaned;
                        needsAuctionSync = true;
                    }
                });
                
                shippedHistory.forEach(car => {
                    const cleaned = formatPlateForDisplay(car.plate);
                    if (car.plate !== cleaned) {
                        car.plate = cleaned;
                        needsShippedSync = true;
                    }
                });
                
                if (needsActiveSync) {
                    saveDataToStorage();
                }
                if (needsAuctionSync) {
                    saveAuctionDataToStorage();
                }
                if (needsShippedSync) {
                    saveShippedDataToStorage();
                }
                
                return; // Pula a carga do LocalStorage local
            } catch (err) {
                console.error("Falha ao carregar dados do Supabase. Usando backup local.", err);
                showToast("Erro ao sincronizar com a nuvem. Carregando dados locais.", "warning");
            }
        }
        
        // --- Fallback LocalStorage ---
        const storedActive = localStorage.getItem('parkflow_active_yards');
        const storedHistory = localStorage.getItem('parkflow_history_yards');
        const storedConfigs = localStorage.getItem('parkflow_configs_yards');
        const storedBanks = localStorage.getItem('parkflow_registered_banks');
        const storedAuction = localStorage.getItem('parkflow_auction_history');
        const storedShipped = localStorage.getItem('parkflow_shipped_history');
        
        let needsSaveActive = false;
        let needsSaveAuction = false;
        let needsSaveShipped = false;

        if (storedActive) {
            activeVehicles = JSON.parse(storedActive);
            activeVehicles.forEach(car => {
                const cleaned = formatPlateForDisplay(car.plate);
                if (car.plate !== cleaned) {
                    car.plate = cleaned;
                    needsSaveActive = true;
                }
            });
        }
        if (storedHistory) {
            history = JSON.parse(storedHistory);
            history.forEach(car => {
                const cleaned = formatPlateForDisplay(car.plate);
                if (car.plate !== cleaned) {
                    car.plate = cleaned;
                    needsSaveActive = true;
                }
            });
        }
        if (storedAuction) {
            auctionHistory = JSON.parse(storedAuction);
            auctionHistory.forEach(car => {
                const cleaned = formatPlateForDisplay(car.plate);
                if (car.plate !== cleaned) {
                    car.plate = cleaned;
                    needsSaveAuction = true;
                }
            });
        }
        if (storedShipped) {
            shippedHistory = JSON.parse(storedShipped);
            shippedHistory.forEach(car => {
                const cleaned = formatPlateForDisplay(car.plate);
                if (car.plate !== cleaned) {
                    car.plate = cleaned;
                    needsSaveShipped = true;
                }
            });
        }

        if (needsSaveActive) saveDataToStorage();
        if (needsSaveAuction) saveAuctionDataToStorage();
        if (needsSaveShipped) saveShippedDataToStorage();

        if (storedConfigs) {
            configs = JSON.parse(storedConfigs);
        } else {
            saveConfigsToStorage();
        }
        if (storedBanks) {
            registeredBanks = JSON.parse(storedBanks);
        } else {
            saveBanksToStorage();
        }
    }

    // --- Supabase Helper Sincronização em Nuvem ---
    async function initSupabaseClient() {
        // Coloque sua URL e KEY do Supabase aqui para nunca mais precisar digitar:
        const HARDCODED_URL = "https://ykzbqbjcwlapjdnijchu.supabase.co"; 
        const HARDCODED_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlremJxYmpjd2xhcGpkbmlqY2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzA5MDYsImV4cCI6MjA5NTg0NjkwNn0.9U5lI0ClkcoGpSvv-zjzP-4z9ev3jTKsxiziabwe2Gk";
        
        let storedUrl = localStorage.getItem('parkflow_supabase_url');
        let storedKey = localStorage.getItem('parkflow_supabase_key');
        
        if (!storedUrl && HARDCODED_URL) {
            storedUrl = HARDCODED_URL;
            storedKey = HARDCODED_KEY;
            localStorage.setItem('parkflow_supabase_url', storedUrl);
            localStorage.setItem('parkflow_supabase_key', storedKey);
        }
        
        if (storedUrl && storedKey) {
            elements.inputSupabaseUrl.value = storedUrl;
            elements.inputSupabaseKey.value = storedKey;
            
            try {
                const supabaseLib = (typeof supabase !== 'undefined') ? supabase : (typeof Supabase !== 'undefined' ? Supabase : undefined);
                
                if (!supabaseLib) {
                    throw new Error('SDK do Supabase não foi carregado. Verifique a internet.');
                }
                
                supabaseClient = supabaseLib.createClient(storedUrl, storedKey);
                
                // Testar conexão buscando uma configuração
                const { data, error } = await supabaseClient
                    .from('configs_yards')
                    .select('*')
                    .limit(1);
                    
                if (error) throw error;
                
                isSupabaseActive = true;
                updateSupabaseUI(true);
            } catch (err) {
                console.error("Supabase connection test failed:", err);
                isSupabaseActive = false;
                updateSupabaseUI(false, "Erro de Conexão");
            }
        } else {
            isSupabaseActive = false;
            updateSupabaseUI(false);
        }
    }

    function updateSupabaseUI(connected, customStatus = "") {
        const badge = elements.supabaseStatusBadge;
        if (!badge) return;
        
        const dot = badge.querySelector('.status-dot');
        const text = badge.querySelector('.status-text');
        
        if (connected) {
            badge.className = "supabase-status-badge online";
            text.textContent = "Conectado (Nuvem)";
            elements.btnSaveSupabase.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Atualizar Conexão`;
            elements.btnDisconnectSupabase.style.display = "flex";
        } else {
            badge.className = "supabase-status-badge offline";
            text.textContent = customStatus ? `${customStatus} (Dados Locais)` : "Desconectado (Dados Locais)";
            elements.btnSaveSupabase.innerHTML = `<i class="fa-solid fa-plug"></i> Conectar e Sincronizar`;
            elements.btnDisconnectSupabase.style.display = "none";
        }
    }

    async function syncActiveYardsToSupabase() {
        if (!isSupabaseActive) return;
        try {
            await supabaseClient.from('active_yards').delete().neq('id', 'placeholder_nunca_existira');
            if (activeVehicles.length > 0) {
                const { error } = await supabaseClient.from('active_yards').insert(activeVehicles);
                if (error) throw error;
            }
        } catch (err) {
            console.error("Erro ao sincronizar active_yards:", err);
            showToast("Erro ao salvar pátios ativos na nuvem.", "error");
        }
    }

    async function syncHistoryToSupabase() {
        if (!isSupabaseActive) return;
        try {
            await supabaseClient.from('history_yards').delete().neq('id', 'placeholder_nunca_existira');
            if (history.length > 0) {
                const { error } = await supabaseClient.from('history_yards').insert(history);
                if (error) throw error;
            }
        } catch (err) {
            console.error("Erro ao sincronizar history_yards:", err);
            showToast("Erro ao salvar histórico de saídas na nuvem.", "error");
        }
    }

    async function syncAuctionToSupabase() {
        if (!isSupabaseActive) return;
        try {
            await supabaseClient.from('auction_history').delete().neq('id', 'placeholder_nunca_existira');
            if (auctionHistory.length > 0) {
                const { error } = await supabaseClient.from('auction_history').insert(auctionHistory);
                if (error) throw error;
            }
        } catch (err) {
            console.error("Erro ao sincronizar auction_history:", err);
            showToast("Erro ao salvar lote de leilão na nuvem.", "error");
        }
    }

    async function syncShippedToSupabase() {
        if (!isSupabaseActive) return;
        try {
            await supabaseClient.from('shipped_history').delete().neq('id', 'placeholder_nunca_existira');
            if (shippedHistory.length > 0) {
                const { error } = await supabaseClient.from('shipped_history').insert(shippedHistory);
                if (error) throw error;
            }
        } catch (err) {
            console.error("Erro ao sincronizar shipped_history:", err);
            showToast("Erro ao salvar embarcados na nuvem.", "error");
        }
    }

    async function syncBanksToSupabase() {
        if (!isSupabaseActive) return;
        try {
            await supabaseClient.from('registered_banks').delete().neq('name', 'placeholder_nunca_existira');
            const dataToInsert = registeredBanks.map(name => ({ name }));
            if (dataToInsert.length > 0) {
                const { error } = await supabaseClient.from('registered_banks').insert(dataToInsert);
                if (error) throw error;
            }
        } catch (err) {
            console.error("Erro ao sincronizar registered_banks:", err);
        }
    }

    async function syncConfigsToSupabase() {
        if (!isSupabaseActive) return;
        try {
            const dataToInsert = [
                { id: 'capRoberto', value: configs.capRoberto },
                { id: 'capTerreno', value: configs.capTerreno },
                { id: 'capBarracao', value: configs.capBarracao }
            ];
            await supabaseClient.from('configs_yards').delete().neq('id', 'placeholder_nunca_existira');
            const { error } = await supabaseClient.from('configs_yards').insert(dataToInsert);
            if (error) throw error;
        } catch (err) {
            console.error("Erro ao sincronizar configs_yards:", err);
        }
    }

    async function syncAllToSupabase() {
        if (!isSupabaseActive) return;
        showToast("Sincronizando tabelas locais com o Supabase...", "info");
        await Promise.all([
            syncActiveYardsToSupabase(),
            syncHistoryToSupabase(),
            syncAuctionToSupabase(),
            syncShippedToSupabase(),
            syncBanksToSupabase(),
            syncConfigsToSupabase()
        ]);
        showToast("Sincronização concluída com sucesso na nuvem!", "success");
    }

    async function handleDisconnectSupabase() {
        const confirmDisconnect = confirm("Deseja realmente desconectar da nuvem? O sistema voltará a utilizar os dados salvos localmente neste computador.");
        if (!confirmDisconnect) return;
        
        localStorage.removeItem('parkflow_supabase_url');
        localStorage.removeItem('parkflow_supabase_key');
        elements.inputSupabaseUrl.value = "";
        elements.inputSupabaseKey.value = "";
        
        supabaseClient = null;
        isSupabaseActive = false;
        updateSupabaseUI(false);
        
        // Recarregar os dados locais do localStorage
        await loadDataFromStorage();
        renderDashboard();
        renderHistory();
        renderLeilaoTable();
        renderShippedTable();
        loadConfigsToInputs();
        
        showToast("Nuvem desconectada! Exibindo dados locais do navegador.", "info");
    }

    function setupSupabaseHandlers() {
        // Toggle Accordion SQL
        elements.btnToggleSqlAccordion.addEventListener('click', () => {
            const isVisible = elements.sqlAccordionContent.style.display === 'flex';
            if (isVisible) {
                elements.sqlAccordionContent.style.display = 'none';
                elements.btnToggleSqlAccordion.classList.remove('active');
            } else {
                elements.sqlAccordionContent.style.display = 'flex';
                elements.btnToggleSqlAccordion.classList.add('active');
            }
        });
        
        // Copiar SQL
        elements.btnCopySql.addEventListener('click', () => {
            const codeText = document.getElementById('sql-code-text').textContent;
            navigator.clipboard.writeText(codeText).then(() => {
                showToast("Script SQL copiado com sucesso!", "success");
            }).catch(err => {
                showToast("Erro ao copiar texto automaticamente.", "error");
            });
        });
        
        // Salvar credenciais
        elements.btnSaveSupabase.addEventListener('click', async () => {
            const url = elements.inputSupabaseUrl.value.trim();
            const key = elements.inputSupabaseKey.value.trim();
            
            if (!url || !key) {
                showToast("Por favor, preencha a URL e a Anon Key!", "warning");
                return;
            }
            
            // Salvar temporariamente para testar
            localStorage.setItem('parkflow_supabase_url', url);
            localStorage.setItem('parkflow_supabase_key', key);
            
            showToast("Testando conexão com o Supabase...", "info");
            await initSupabaseClient();
            
            if (isSupabaseActive) {
                const sendLocal = confirm("Conectado à nuvem com sucesso!\n\nDeseja ENVIAR os dados do seu computador atual para a nuvem?\n\nClique em [OK] para enviar seus dados locais.\nClique em [Cancelar] se preferir baixar os dados que já estão na nuvem.");
                if (sendLocal) {
                    await syncAllToSupabase();
                } else {
                    await loadDataFromStorage();
                    renderDashboard();
                    renderHistory();
                    renderLeilaoTable();
                    renderShippedTable();
                    loadConfigsToInputs();
                    showToast("Dados carregados da nuvem!", "success");
                }
            } else {
                // Falhou conexão, limpar
                localStorage.removeItem('parkflow_supabase_url');
                localStorage.removeItem('parkflow_supabase_key');
                showToast("Falha de conexão. Verifique a URL e a Anon Key e certifique-se de que já rodou o script SQL no editor do Supabase.", "error");
            }
        });
        
        // Desconectar credenciais
        elements.btnDisconnectSupabase.addEventListener('click', handleDisconnectSupabase);
    }

    function saveBanksToStorage() {
        localStorage.setItem('parkflow_registered_banks', JSON.stringify(registeredBanks));
        if (isSupabaseActive) syncBanksToSupabase();
    }

    function saveDataToStorage() {
        localStorage.setItem('parkflow_active_yards', JSON.stringify(activeVehicles));
        localStorage.setItem('parkflow_history_yards', JSON.stringify(history));
        if (isSupabaseActive) {
            syncActiveYardsToSupabase();
            syncHistoryToSupabase();
        }
    }

    function saveAuctionDataToStorage() {
        localStorage.setItem('parkflow_auction_history', JSON.stringify(auctionHistory));
        if (isSupabaseActive) syncAuctionToSupabase();
    }

    function saveShippedDataToStorage() {
        localStorage.setItem('parkflow_shipped_history', JSON.stringify(shippedHistory));
        if (isSupabaseActive) syncShippedToSupabase();
    }

    function saveConfigsToStorage() {
        localStorage.setItem('parkflow_configs_yards', JSON.stringify(configs));
        if (isSupabaseActive) syncConfigsToSupabase();
    }

    // --- Live Clock ---
    function startLiveClock() {
        const updateClock = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('pt-BR');
            const dateStr = now.toLocaleDateString('pt-BR');
            elements.liveClock.textContent = `${timeStr} - ${dateStr}`;
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    function setCurrentTimeInInput() {
        const now = new Date();
        const localISOString = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        elements.inputEntrada.value = localISOString;
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        // Logout Button
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                sessionStorage.removeItem('parkflow_logged_in');
                location.reload();
            });
        }

        // Tab Navigation (Dashboard, History, Settings)
        elements.btnDashboard.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('dashboard');
        });
        
        elements.btnHistoryTab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('historico');
        });

        elements.btnLeilaoTab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('leilao');
        });

        elements.btnShippedTab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('embarcados');
        });
        
        elements.btnSettings.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('configuracoes');
        });

        // Set Now button on Entry Form
        elements.btnSetNow.addEventListener('click', () => {
            setCurrentTimeInInput();
            showToast('Data/Hora atualizada para agora.', 'success');
        });

        // Form Entry Submit
        elements.formEntry.addEventListener('submit', handleEntrySubmit);

        // Instant Search Fields
        elements.searchActive.addEventListener('input', () => filterActiveTable());
        elements.searchHistory.addEventListener('input', () => filterHistoryTable());
        elements.searchLeilao.addEventListener('input', () => filterLeilaoTable());
        elements.searchShipped.addEventListener('input', () => filterShippedTable());
        elements.filterShippedMonth.addEventListener('change', () => renderShippedTable());

        // Yard Tab Filters for Active Table
        elements.yardTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                elements.yardTabs.forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                activeYardFilter = e.currentTarget.getAttribute('data-yard');
                renderActiveTable();
            });
        });

        // Configuration Save
        elements.btnSaveConfigs.addEventListener('click', handleSaveConfigs);
        
        // History Operations (CSV & Clear)
        elements.btnClearHistory.addEventListener('click', handleClearHistory);
        elements.btnExportCsv.addEventListener('click', handleExportCsv);
        
        // Leilão Operations (CSV & Clear)
        elements.btnClearLeilao.addEventListener('click', handleClearLeilao);
        elements.btnExportLeilaoCsv.addEventListener('click', handleExportLeilaoCsv);

        // Embarcados Operations (CSV & Clear)
        elements.btnClearShipped.addEventListener('click', handleClearShipped);
        elements.btnExportShippedCsv.addEventListener('click', handleExportShippedCsv);
        elements.btnTriggerDeleteShipped.addEventListener('click', handleTriggerDeleteShipped);
        elements.btnCancelDeleteShipped.addEventListener('click', handleCancelDeleteShipped);

        // Backup Operations
        elements.btnBackupNowBanner.addEventListener('click', handleCreateBackup);
        elements.btnCreateBackup.addEventListener('click', handleCreateBackup);
        elements.btnTriggerUploadFile.addEventListener('click', () => elements.inputBackupFile.click());
        elements.inputBackupFile.addEventListener('change', handleBackupFileSelect);
        elements.btnRestoreBackup.addEventListener('click', handleRestoreBackup);

        // CSV Import Operations
        elements.btnTriggerUploadCsv.addEventListener('click', () => elements.inputImportCsv.click());
        elements.inputImportCsv.addEventListener('change', handleImportCsvSelect);
        elements.btnConfirmImportCsv.addEventListener('click', handleConfirmImportCsv);

        // Checkout Modal Events
        elements.modalCloseBtn.addEventListener('click', closeCheckoutModal);
        elements.btnCancelCheckout.addEventListener('click', closeCheckoutModal);
        elements.btnModalSetNow.addEventListener('click', setModalExitTimeToNow);
        elements.modalTimeExit.addEventListener('change', recalculateCheckoutDuration);
        elements.btnConfirmCheckout.addEventListener('click', handleConfirmCheckout);

        // Leilão Checkout Modal Events
        elements.modalCloseLeilaoBtn.addEventListener('click', closeLeilaoModal);
        elements.btnCancelLeilao.addEventListener('click', closeLeilaoModal);
        elements.btnModalLeilaoSetNow.addEventListener('click', setModalLeilaoExitTimeToNow);
        elements.modalLeilaoTimeExit.addEventListener('change', recalculateLeilaoValues);
        elements.inputLeilaoTransi.addEventListener('input', recalculateLeilaoValues);
        elements.inputLeilaoEs.addEventListener('input', recalculateLeilaoValues);
        elements.inputLeilaoExtras.addEventListener('input', recalculateLeilaoValues);
        elements.btnConfirmLeilao.addEventListener('click', handleConfirmLeilao);

        // Transfer Modal Events
        elements.modalCloseTransferBtn.addEventListener('click', closeTransferModal);
        elements.btnCancelTransfer.addEventListener('click', closeTransferModal);
        elements.btnConfirmTransfer.addEventListener('click', handleConfirmTransfer);
        
        // Edit Bank Modal Events
        elements.btnCloseEditBankModal.addEventListener('click', closeEditBankModal);
        elements.btnCancelEditBank.addEventListener('click', closeEditBankModal);
        elements.btnConfirmEditBank.addEventListener('click', handleConfirmEditBank);
        
        // Checklist Events
        elements.btnCloseChecklistModal.addEventListener('click', closeChecklistModal);
        elements.btnPrintChecklist.addEventListener('click', () => { window.print(); });
        
        // Format License Plate Input automatically as user types (Only letters and numbers, max 7 chars, no hyphens)
        elements.inputPlaca.addEventListener('input', (e) => {
            let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            
            if (val.length > 7) {
                val = val.substring(0, 7);
            }
            
            e.target.value = val;
        });

        // Add bank listener
        elements.formAddBank.addEventListener('submit', (e) => {
            e.preventDefault();
            const newBankName = elements.inputNewBank.value.trim();
            
            if (!newBankName) return;
            
            const isDuplicate = registeredBanks.some(b => b.toLowerCase() === newBankName.toLowerCase());
            if (isDuplicate) {
                showToast('Este banco já está cadastrado!', 'warning');
                return;
            }
            
            registeredBanks.push(newBankName);
            saveBanksToStorage();
            elements.inputNewBank.value = '';
            
            renderRegisteredBanksList();
            populateBankDropdown();
            showToast(`Banco "${newBankName}" cadastrado com sucesso!`, 'success');
        });
        
        // Supabase Handlers
        setupSupabaseHandlers();
    }

    // --- Tab Switcher (Sections) ---
    function switchTab(tabName) {
        elements.btnDashboard.classList.remove('active');
        elements.btnHistoryTab.classList.remove('active');
        elements.btnLeilaoTab.classList.remove('active');
        elements.btnShippedTab.classList.remove('active');
        elements.btnSettings.classList.remove('active');
        
        elements.secDashboard.classList.remove('active');
        elements.secHistory.classList.remove('active');
        elements.secLeilao.classList.remove('active');
        elements.secShipped.classList.remove('active');
        elements.secSettings.classList.remove('active');
        
        setTimeout(() => {
            elements.secDashboard.style.display = 'none';
            elements.secHistory.style.display = 'none';
            elements.secLeilao.style.display = 'none';
            elements.secShipped.style.display = 'none';
            elements.secSettings.style.display = 'none';
            
            if (tabName === 'dashboard') {
                elements.btnDashboard.classList.add('active');
                elements.secDashboard.style.display = 'flex';
                setTimeout(() => elements.secDashboard.classList.add('active'), 50);
                elements.pageTitle.textContent = "Controle de Veículos nos Pátios";
                elements.pageSubtitle.textContent = "Rastreamento logístico e monitoramento em tempo real";
                renderDashboard();
            } else if (tabName === 'historico') {
                elements.btnHistoryTab.classList.add('active');
                elements.secHistory.style.display = 'flex';
                setTimeout(() => elements.secHistory.classList.add('active'), 50);
                elements.pageTitle.textContent = "Histórico de Saídas";
                elements.pageSubtitle.textContent = "Acompanhamento detalhado de todas as saídas e transferências";
                renderHistory();
            } else if (tabName === 'leilao') {
                elements.btnLeilaoTab.classList.add('active');
                elements.secLeilao.style.display = 'flex';
                setTimeout(() => elements.secLeilao.classList.add('active'), 50);
                elements.pageTitle.textContent = "Fechamento de Veículos para Leilão";
                elements.pageSubtitle.textContent = "Controle financeiro de veículos coletados e consolidação de planilhas";
                renderLeilaoTable();
            } else if (tabName === 'embarcados') {
                elements.btnShippedTab.classList.add('active');
                elements.secShipped.style.display = 'flex';
                setTimeout(() => elements.secShipped.classList.add('active'), 50);
                elements.pageTitle.textContent = "Veículos Embarcados para Leilão";
                elements.pageSubtitle.textContent = "Consulta de lotes exportados e consultas históricas definitivas";
                renderShippedTable();
            } else if (tabName === 'configuracoes') {
                elements.btnSettings.classList.add('active');
                elements.secSettings.style.display = 'flex';
                setTimeout(() => elements.secSettings.classList.add('active'), 50);
                elements.pageTitle.textContent = "Configurações de Capacidades";
                elements.pageSubtitle.textContent = "Altere o limite máximo de veículos alocados por pátio";
                loadConfigsToInputs();
            }
        }, 150);
    }

    // --- Plate Validation & Format ---
    function isValidPlate(plate) {
        const clean = plate.replace(/[^A-Z0-9]/g, '');
        const oldPlateNoHyphenPattern = /^[A-Z]{3}[0-9]{4}$/;
        const mercosulPlatePattern = /^[A-Z]{3}[0-9]{1}[A-Z]{1}[0-9]{2}$/;
        
        return oldPlateNoHyphenPattern.test(clean) || mercosulPlatePattern.test(clean);
    }

    function formatPlateForDisplay(plate) {
        return plate.replace(/[^A-Z0-9]/g, '');
    }

    function isPlateMercosul(plate) {
        const clean = plate.replace(/[^A-Z0-9]/g, '');
        return /^[A-Z]{3}[0-9]{1}[A-Z]{1}[0-9]{2}$/.test(clean);
    }

    // --- Count Vehicles in specific yard ---
    function getCountInYard(yardName) {
        return activeVehicles.filter(car => car.yard === yardName).length;
    }

    // --- Entry Form Action ---
    function handleEntrySubmit(e) {
        e.preventDefault();
        
        let plate = elements.inputPlaca.value.trim().toUpperCase();
        const model = capitalizeWords(elements.inputModelo.value.trim());
        const yard = elements.selectPatio.value;
        const entryTimeVal = elements.inputEntrada.value;
        const bank = elements.selectBanco.value;
        
        if (!bank) {
            showToast('Por favor, selecione um banco!', 'error');
            return;
        }
        
        // Validations
        if (!isValidPlate(plate)) {
            showToast('Placa inválida! Use formatos como ABC-1234 ou ABC1D23.', 'error');
            return;
        }
        
        plate = formatPlateForDisplay(plate);
        
        // Check if active
        const alreadyActive = activeVehicles.some(car => car.plate === plate);
        if (alreadyActive) {
            showToast(`O veículo com placa ${plate} já está alocado em um dos pátios!`, 'warning');
            return;
        }
        
        // Yard Capacity Check
        const currentYardCount = getCountInYard(yard);
        let maxCap = configs.capRoberto;
        if (yard === 'Patio Terreno') maxCap = configs.capTerreno;
        if (yard === 'Patio Barracao') maxCap = configs.capBarracao;
        
        if (currentYardCount >= maxCap) {
            showToast(`Não há vagas no ${getYardNameDisplay(yard)}! (Capacidade: ${maxCap})`, 'error');
            return;
        }

        const newVehicle = {
            id: Date.now().toString(),
            plate,
            model,
            yard,
            entryTime: new Date(entryTimeVal).toISOString(),
            bank
        };
        
        // Save
        activeVehicles.push(newVehicle);
        saveDataToStorage();
        
        // Reset Form
        elements.formEntry.reset();
        setCurrentTimeInInput();
        
        // Re-render
        renderDashboard();
        showToast(`Veículo ${model} (${plate}) alocado no ${getYardNameDisplay(yard)} com sucesso!`, 'success');
    }

    // --- Render Dashboard counts ---
    function renderDashboard() {
        const robertoCount = getCountInYard('Patio Roberto');
        const terrenoCount = getCountInYard('Patio Terreno');
        const barracaoCount = getCountInYard('Patio Barracao');
        
        elements.statActiveRoberto.textContent = robertoCount;
        elements.statActiveTerreno.textContent = terrenoCount;
        elements.statActiveBarracao.textContent = barracaoCount;
        elements.statActiveTotal.textContent = activeVehicles.length;
        
        elements.capLabelRoberto.innerHTML = `<span>Vagas: ${escapeHTML(robertoCount)} / ${escapeHTML(configs.capRoberto)}</span>`;
        elements.capLabelTerreno.innerHTML = `<span>Vagas: ${escapeHTML(terrenoCount)} / ${escapeHTML(configs.capTerreno)}</span>`;
        elements.capLabelBarracao.innerHTML = `<span>Vagas: ${escapeHTML(barracaoCount)} / ${escapeHTML(configs.capBarracao)}</span>`;
        
        renderActiveTable();
    }

    // --- Render Active Table ---
    function renderActiveTable() {
        const query = elements.searchActive.value.toLowerCase().trim();
        
        // Filter by Search Query AND by Yard Tab Selection
        const filtered = activeVehicles.filter(car => {
            const matchesQuery = car.plate.toLowerCase().includes(query) || 
                                 car.model.toLowerCase().includes(query) ||
                                 car.bank.toLowerCase().includes(query);
            
            const matchesYard = activeYardFilter === 'all' || car.yard === activeYardFilter;
            
            return matchesQuery && matchesYard;
        });
        
        if (filtered.length === 0) {
            elements.tbodyActive.innerHTML = `
                <tr class="empty-state-row">
                    <td colspan="6">
                        <div class="empty-state">
                            <i class="fa-solid fa-square-parking"></i>
                            <p>${escapeHTML(query) ? 'Nenhum veículo correspondente encontrado' : 'Nenhum veículo alocado neste pátio'}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        elements.tbodyActive.innerHTML = filtered.map(car => {
            const entryDate = new Date(car.entryTime);
            const formattedEntry = formatDate(entryDate);
            const isMercosul = isPlateMercosul(car.plate);
            
            return `
                <tr>
                    <td><span class="badge-plate ${isMercosul ? 'badge-plate-mercosul' : ''}">${escapeHTML(car.plate)}</span></td>
                    <td style="font-weight:600;">${escapeHTML(capitalizeWords(car.model))}</td>
                    <td><span class="badge-yard ${getYardClass(car.yard)}">${getYardNameDisplay(car.yard)}</span></td>
                    <td>${formattedEntry}</td>
                    <td style="font-size:0.88rem;color:var(--text-secondary);">${escapeHTML(car.bank)}</td>
                    <td class="text-right">
                        <div class="actions-cell">
                            ${car.checklist_data ? `
                            <button class="btn-primary btn-small action-view-checklist-btn" data-id="${car.id}" title="Visualizar Checklist" style="background:var(--color-blue-gradient);box-shadow:none;border:none;">
                                <i class="fa-solid fa-file-signature"></i> Checklist
                            </button>
                            ` : ''}
                            <button class="btn-secondary btn-small action-edit-bank-btn" data-id="${car.id}" title="Alterar Banco">
                                <i class="fa-solid fa-pen-to-square"></i> Banco
                            </button>
                            <button class="btn-secondary btn-small action-transfer-btn" data-id="${car.id}" title="Transferir de pátio">
                                <i class="fa-solid fa-right-left"></i> Mover
                            </button>
                            <button class="btn-primary btn-small action-leilao-btn" data-id="${car.id}" title="Liberar veículo" style="background:var(--color-orange-gradient);box-shadow:none;">
                                <i class="fa-solid fa-unlock"></i> Liberado
                            </button>
                            <button class="btn-success btn-small action-checkout-btn" data-id="${car.id}">
                                <i class="fa-solid fa-circle-check"></i> Saída
                            </button>
                            <button class="btn-danger btn-small action-delete-btn" data-id="${car.id}" title="Excluir Veículo">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add dynamic listeners
        document.querySelectorAll('.action-checkout-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const carId = e.currentTarget.getAttribute('data-id');
                openCheckoutModal(carId);
            });
        });

        document.querySelectorAll('.action-leilao-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const carId = e.currentTarget.getAttribute('data-id');
                openLeilaoModal(carId);
            });
        });

        document.querySelectorAll('.action-transfer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const carId = e.currentTarget.getAttribute('data-id');
                openTransferModal(carId);
            });
        });

        document.querySelectorAll('.action-edit-bank-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const carId = e.currentTarget.getAttribute('data-id');
                openEditBankModal(carId);
            });
        });

        document.querySelectorAll('.action-view-checklist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const carId = e.currentTarget.getAttribute('data-id');
                openChecklistModal(carId);
            });
        });

        document.querySelectorAll('.action-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const carId = e.currentTarget.getAttribute('data-id');
                deleteVehicle(carId);
            });
        });
    }

    function deleteVehicle(carId) {
        const car = activeVehicles.find(item => item.id === carId);
        if (!car) return;
        
        if (confirm(`Tem certeza que deseja excluir permanentemente o veículo ${car.model} (${car.plate})?`)) {
            activeVehicles = activeVehicles.filter(item => item.id !== carId);
            saveDataToStorage();
            renderDashboard();
            showToast(`Veículo ${car.plate} excluído com sucesso.`, 'success');
        }
    }

    let currentEditBankVehicle = null;

    function openEditBankModal(carId) {
        const car = activeVehicles.find(item => item.id === carId);
        if (!car) {
            showToast('Veículo não encontrado.', 'error');
            return;
        }
        
        currentEditBankVehicle = car;
        
        elements.modalEditBankPlateBadge.textContent = car.plate;
        if (isPlateMercosul(car.plate)) {
            elements.modalEditBankPlateBadge.classList.add('badge-plate-mercosul');
        } else {
            elements.modalEditBankPlateBadge.classList.remove('badge-plate-mercosul');
        }
        elements.modalEditBankModelBadge.textContent = car.model;
        
        elements.selectEditBank.innerHTML = registeredBanks.map(b => 
            `<option value="${b}" ${b === car.bank ? 'selected' : ''}>${b}</option>`
        ).join('');
        
        elements.modalEditBank.classList.add('active');
    }

    function closeEditBankModal() {
        elements.modalEditBank.classList.remove('active');
        currentEditBankVehicle = null;
    }

    function handleConfirmEditBank() {
        if (!currentEditBankVehicle) return;
        
        const newBank = elements.selectEditBank.value;
        if (!newBank) {
            showToast('Selecione um banco válido.', 'error');
            return;
        }
        
        currentEditBankVehicle.bank = newBank;
        saveDataToStorage();
        
        closeEditBankModal();
        renderDashboard();
        
        showToast(`Banco atualizado para ${newBank}.`, 'success');
    }

    // --- Checklist Modal Handling ---
    function closeChecklistModal() {
        elements.modalChecklistPrint.classList.remove('active');
    }

    function openChecklistModal(carId) {
        const car = activeVehicles.find(item => item.id === carId);
        if (!car || !car.checklist_data) {
            showToast('Dados de checklist não disponíveis.', 'error');
            return;
        }

        const data = car.checklist_data;

        document.getElementById('print-placa').textContent = car.plate;
        document.getElementById('print-chassi').textContent = data.chassi || 'N/A';
        document.getElementById('print-marca').textContent = data.marca || 'N/A';
        document.getElementById('print-modelo').textContent = car.model;
        document.getElementById('print-ano').textContent = data.ano || 'N/A';
        document.getElementById('print-data').textContent = formatDate(new Date(car.entryTime));
        document.getElementById('print-banco').textContent = car.bank;
        document.getElementById('print-patio').textContent = getYardNameDisplay(car.yard);

        // Populate Sim/Nao
        const setYN = (idPrefix, val) => {
            document.getElementById(idPrefix + '-sim').textContent = val ? 'X' : '';
            document.getElementById(idPrefix + '-nao').textContent = !val ? 'X' : '';
        };

        const eq = data.interior || {};
        setYN('print-doc', eq.originalDoc);
        setYN('print-key', eq.originalKey);
        setYN('print-spare', eq.spareKey);
        setYN('print-manual', eq.manual);
        setYN('print-jack', eq.jack);
        setYN('print-wheel', eq.wheelWrench);
        setYN('print-triangle', eq.triangle);
        setYN('print-ext', eq.extinguisher);
        setYN('print-radio', eq.radio);
        setYN('print-cd', eq.cdPlayer);
        setYN('print-multi', eq.multimedia);

        // Tires
        const setTire = (idPrefix, pneu) => {
            if(!pneu) return;
            document.getElementById(idPrefix + '-m').textContent = pneu.marca || '';
            document.getElementById(idPrefix + '-e').textContent = pneu.estado || '';
        };

        const pn = data.pneus || {};
        setTire('print-pneu-dd', pn.dianteiroDireito);
        setTire('print-pneu-de', pn.dianteiroEsquerdo);
        setTire('print-pneu-td', pn.traseiroDireito);
        setTire('print-pneu-te', pn.traseiroEsquerdo);
        setTire('print-pneu-est', pn.estepe);

        document.getElementById('print-estado-veiculo').textContent = data.estadoVeiculo || '';

        // Assinaturas details
        const origem = data.origem || {};
        const destino = data.destino || {};

        document.getElementById('print-origem-data').textContent = origem.data || '';
        document.getElementById('print-origem-cidade').textContent = origem.cidade || '';
        document.getElementById('print-destino-data').textContent = destino.data || '';
        document.getElementById('print-destino-cidade').textContent = destino.cidade || '';

        // Draw signatures
        drawSignature('canvas-origem-mot', origem.assinaturaMotorista);
        drawSignature('canvas-origem-resp', origem.assinaturaResponsavel);
        drawSignature('canvas-destino-mot', destino.assinaturaMotorista);
        drawSignature('canvas-destino-resp', destino.assinaturaResponsavel);

        // Process photos
        const photosGrid = document.getElementById('print-photos-grid');
        const photosContainer = document.getElementById('print-photos-container');
        if (photosGrid && photosContainer) {
            photosGrid.innerHTML = ''; // clear
            
            if (data.fotos && (data.fotos.Frente || data.fotos.Traseira || data.fotos['Lateral Esquerda'] || data.fotos['Lateral Direita'])) {
                photosContainer.style.display = 'block';
                const labels = ['Frente', 'Traseira', 'Lateral Esquerda', 'Lateral Direita'];
                labels.forEach(label => {
                    if (data.fotos[label]) {
                        photosGrid.innerHTML += `
                            <div style="text-align: center; width: 100%;">
                                <img src="${data.fotos[label]}" alt="${label}" style="max-width: 100%; max-height: 200px; border: 1px solid #ccc; border-radius: 4px; object-fit: contain;">
                                <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: bold;">${label}</p>
                            </div>
                        `;
                    }
                });
            } else {
                photosContainer.style.display = 'none';
            }
        }

        elements.modalChecklistPrint.classList.add('active');
    }

    function drawSignature(canvasId, sigBase64) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw line
        ctx.beginPath();
        ctx.moveTo(10, canvas.height - 10);
        ctx.lineTo(canvas.width - 10, canvas.height - 10);
        ctx.strokeStyle = '#ccc';
        ctx.stroke();

        if (sigBase64) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height - 10);
            };
            img.src = sigBase64;
        }
    }

    function filterActiveTable() {
        renderActiveTable();
    }

    // --- Render History ---
    function renderHistory() {
        const query = elements.searchHistory.value.toLowerCase().trim();
        const filtered = history.filter(item => 
            item.plate.toLowerCase().includes(query) || 
            item.model.toLowerCase().includes(query) ||
            item.bank.toLowerCase().includes(query) ||
            item.yard.toLowerCase().includes(query)
        );
        
        filtered.sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime));

        if (filtered.length === 0) {
            elements.tbodyHistory.innerHTML = `
                <tr class="empty-state-row">
                    <td colspan="7">
                        <div class="empty-state">
                            <i class="fa-solid fa-receipt"></i>
                            <p>${escapeHTML(query) ? 'Nenhum registro encontrado no histórico' : 'Nenhuma saída registrada no histórico'}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        elements.tbodyHistory.innerHTML = filtered.map(item => {
            const entryDate = new Date(item.entryTime);
            const exitDate = new Date(item.exitTime);
            const isMercosul = isPlateMercosul(item.plate);
            
            return `
                <tr>
                    <td><span class="badge-plate ${isMercosul ? 'badge-plate-mercosul' : ''}">${escapeHTML(item.plate)}</span></td>
                    <td style="font-weight:600;">${escapeHTML(capitalizeWords(item.model))}</td>
                    <td><span class="badge-yard ${getYardClass(item.yard)}">${getYardNameDisplay(item.yard)}</span></td>
                    <td>${formatDate(entryDate)}</td>
                    <td>${formatDate(exitDate)}</td>
                    <td style="font-size:0.88rem;color:var(--text-secondary);">${escapeHTML(item.bank)}</td>
                    <td class="text-right text-blue" style="font-weight:600;">${item.duration}</td>
                </tr>
            `;
        }).join('');
    }

    function filterHistoryTable() {
        renderHistory();
    }

    // --- Helpers Formatters & Names ---
    function formatDate(date) {
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function capitalizeWords(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
    }

    function getYardNameDisplay(yardName) {
        if (yardName === 'Patio Roberto') return 'Pátio Roberto';
        if (yardName === 'Patio Terreno') return 'Pátio Terreno';
        if (yardName === 'Patio Barracao') return 'Pátio Barracão';
        return yardName;
    }

    function getYardClass(yardName) {
        if (yardName === 'Patio Roberto') return 'roberto';
        if (yardName === 'Patio Terreno') return 'terreno';
        if (yardName === 'Patio Barracao') return 'barracao';
        if (yardName === 'RJ ASSISTENCIA VEICULAR') return 'rj-empresa';
        return '';
    }

    // --- Time Duration Calculations (Logistics) ---
    function calculateDuration(entryTimeStr, exitTimeStr) {
        const entry = new Date(entryTimeStr);
        const exit = new Date(exitTimeStr);
        
        let diffMs = exit - entry;
        
        if (diffMs < 0) {
            return { durationStr: 'Entrada após a saída!', isValid: false };
        }
        
        const totalMinutes = Math.floor(diffMs / 1000 / 60);
        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const minutes = totalMinutes % 60;
        
        let parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        parts.push(`${minutes}m`);
        
        return { durationStr: parts.join(' '), isValid: true };
    }

    // --- Exit / Check-out Modal Logic ---
    function openCheckoutModal(carId) {
        const car = activeVehicles.find(item => item.id === carId);
        if (!car) {
            showToast('Veículo não encontrado.', 'error');
            return;
        }
        
        currentCheckoutVehicle = car;
        
        elements.modalPlateBadge.textContent = car.plate;
        if (isPlateMercosul(car.plate)) {
            elements.modalPlateBadge.classList.add('badge-plate-mercosul');
        } else {
            elements.modalPlateBadge.classList.remove('badge-plate-mercosul');
        }
        elements.modalModelBadge.textContent = car.model;
        elements.modalRegisteredYard.textContent = getYardNameDisplay(car.yard);
        elements.modalRegisteredBank.textContent = car.bank;
        elements.modalTimeEntry.textContent = formatDate(new Date(car.entryTime));
        
        // Prefill modal exit time to now
        const now = new Date();
        const localISOString = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        elements.modalTimeExit.value = localISOString;
        
        recalculateCheckoutDuration();
        
        // Open
        elements.modalCheckout.classList.add('active');
    }

    function closeCheckoutModal() {
        elements.modalCheckout.classList.remove('active');
        currentCheckoutVehicle = null;
    }

    function setModalExitTimeToNow() {
        const now = new Date();
        const localISOString = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        elements.modalTimeExit.value = localISOString;
        recalculateCheckoutDuration();
        showToast('Data/Hora de saída ajustada para agora.', 'success');
    }

    function recalculateCheckoutDuration() {
        if (!currentCheckoutVehicle) return;
        
        const entryTime = currentCheckoutVehicle.entryTime;
        const exitTimeVal = elements.modalTimeExit.value;
        const exitTime = new Date(exitTimeVal).toISOString();
        
        const calc = calculateDuration(entryTime, exitTime);
        
        elements.modalDuration.textContent = calc.durationStr;
        
        if (calc.isValid === false) {
            elements.btnConfirmCheckout.setAttribute('disabled', 'true');
            elements.modalDuration.style.color = 'var(--color-danger)';
        } else {
            elements.btnConfirmCheckout.removeAttribute('disabled');
            elements.modalDuration.style.color = '';
        }
    }

    function handleConfirmCheckout() {
        if (!currentCheckoutVehicle) return;
        
        const exitTimeVal = elements.modalTimeExit.value;
        const exitTime = new Date(exitTimeVal).toISOString();
        
        const calc = calculateDuration(currentCheckoutVehicle.entryTime, exitTime);
        
        if (!calc.isValid) {
            showToast('Erro: A data de saída não pode ser menor que a data de entrada.', 'error');
            return;
        }

        const historyRecord = {
            id: currentCheckoutVehicle.id,
            plate: currentCheckoutVehicle.plate,
            model: currentCheckoutVehicle.model,
            yard: currentCheckoutVehicle.yard,
            entryTime: currentCheckoutVehicle.entryTime,
            exitTime: exitTime,
            bank: currentCheckoutVehicle.bank,
            duration: calc.durationStr
        };

        // Remove from active yard list
        activeVehicles = activeVehicles.filter(car => car.id !== currentCheckoutVehicle.id);
        
        // Add to history
        history.push(historyRecord);
        
        saveDataToStorage();
        closeCheckoutModal();
        renderDashboard();
        
        showToast(`Saída do veículo ${historyRecord.model} (${historyRecord.plate}) registrada! Tempo: ${calc.durationStr}`, 'success');
    }

    // --- Transfer Modal Logic (Logistics move) ---
    function openTransferModal(carId) {
        const car = activeVehicles.find(item => item.id === carId);
        if (!car) {
            showToast('Veículo não encontrado.', 'error');
            return;
        }
        
        currentTransferVehicle = car;
        
        elements.modalTransferPlate.textContent = car.plate;
        if (isPlateMercosul(car.plate)) {
            elements.modalTransferPlate.classList.add('badge-plate-mercosul');
        } else {
            elements.modalTransferPlate.classList.remove('badge-plate-mercosul');
        }
        elements.modalTransferModel.textContent = car.model;
        elements.modalTransferCurrentYard.textContent = getYardNameDisplay(car.yard);
        
        // Populate select list highlighting/enabling all yards
        const yards = [
            { val: "Patio Roberto", text: "Pátio Roberto" },
            { val: "Patio Terreno", text: "Pátio Terreno" },
            { val: "Patio Barracao", text: "Pátio Barracão" }
        ];
        
        elements.modalSelectTransferYard.innerHTML = yards.map(y => 
            `<option value="${y.val}" ${y.val === car.yard ? 'disabled selected style="color:var(--text-muted);"' : ''}>${y.text} ${y.val === car.yard ? '(Atual)' : ''}</option>`
        ).join('');

        // Open
        elements.modalTransfer.classList.add('active');
    }

    function closeTransferModal() {
        elements.modalTransfer.classList.remove('active');
        currentTransferVehicle = null;
    }

    function handleConfirmTransfer() {
        if (!currentTransferVehicle) return;
        
        const targetYard = elements.modalSelectTransferYard.value;
        const currentYard = currentTransferVehicle.yard;
        
        if (targetYard === currentYard || !targetYard) {
            showToast('Escolha um pátio diferente do atual.', 'warning');
            return;
        }

        // Capacity Check of target yard
        const targetCount = getCountInYard(targetYard);
        let maxCap = configs.capRoberto;
        if (targetYard === 'Patio Terreno') maxCap = configs.capTerreno;
        if (targetYard === 'Patio Barracao') maxCap = configs.capBarracao;
        
        if (targetCount >= maxCap) {
            showToast(`Erro de transferência: O ${getYardNameDisplay(targetYard)} já está cheio! (Capacidade: ${maxCap})`, 'error');
            return;
        }

        // Apply Transfer
        currentTransferVehicle.yard = targetYard;
        saveDataToStorage();
        closeTransferModal();
        renderDashboard();
        
        showToast(`Veículo ${currentTransferVehicle.model} (${currentTransferVehicle.plate}) movido para o ${getYardNameDisplay(targetYard)}!`, 'success');
    }

    // --- Configuration Logic ---
    function loadConfigsToInputs() {
        elements.configCapRoberto.value = configs.capRoberto;
        elements.configCapTerreno.value = configs.capTerreno;
        elements.configCapBarracao.value = configs.capBarracao;
    }

    function handleSaveConfigs() {
        const capRob = parseInt(elements.configCapRoberto.value);
        const capTer = parseInt(elements.configCapTerreno.value);
        const capBar = parseInt(elements.configCapBarracao.value);

        if (isNaN(capRob) || capRob < 1 || isNaN(capTer) || capTer < 1 || isNaN(capBar) || capBar < 1) {
            showToast('As capacidades dos pátios devem ser de pelo menos 1 vaga.', 'error');
            return;
        }

        // Check if new configurations are below active vehicles already allocated
        const currentRobCount = getCountInYard('Patio Roberto');
        const currentTerCount = getCountInYard('Patio Terreno');
        const currentBarCount = getCountInYard('Patio Barracao');
        
        if (capRob < currentRobCount || capTer < currentTerCount || capBar < currentBarCount) {
            showToast('Erro: Você não pode definir uma capacidade menor do que a quantidade de veículos atualmente alocados no pátio!', 'error');
            return;
        }

        configs.capRoberto = capRob;
        configs.capTerreno = capTer;
        configs.capBarracao = capBar;
        
        saveConfigsToStorage();
        showToast('Configurações de capacidades atualizadas com sucesso!', 'success');
    }

    // --- History Log Operations ---
    function handleClearHistory() {
        const confirmClear = confirm('Tem certeza absoluta que deseja limpar todo o histórico logístico? Essa ação não poderá ser desfeita.');
        if (confirmClear) {
            history = [];
            saveDataToStorage();
            renderHistory();
            showToast('O histórico logístico foi limpo completamente.', 'warning');
        }
    }

    function handleExportCsv() {
        if (history.length === 0) {
            showToast('Não há saídas no histórico para exportar!', 'warning');
            return;
        }

        // CSV Header (No finance columns)
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Placa;Modelo;Patio Original;Data Entrada;Data Saida;Banco;Tempo Total\r\n";

        // Rows
        history.forEach(item => {
            const entryFormatted = formatDate(new Date(item.entryTime)).replace(' - ', ' ');
            const exitFormatted = formatDate(new Date(item.exitTime)).replace(' - ', ' ');
            const yardFormatted = getYardNameDisplay(item.yard);
            
            csvContent += `"${item.plate}";"${capitalizeWords(item.model)}";"${yardFormatted}";"${entryFormatted}";"${exitFormatted}";"${item.bank}";"${item.duration}"\r\n`;
        });

        // Trigger Download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ParkFlow_Logistica_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Relatório logístico CSV exportado com sucesso!', 'success');
    }

    // --- Toast Notifications System ---
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fa-circle-info';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'warning') icon = 'fa-triangle-exclamation';
        if (type === 'error') icon = 'fa-circle-xmark';
        
        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${escapeHTML(message)}</span>
        `;
        
        elements.toastContainer.appendChild(toast);
        
        // Remove toast
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(15px) scale(0.9)';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4500);
    }

    // --- Registered Banks Logistics & List rendering ---
    function populateBankDropdown() {
        if (registeredBanks.length === 0) {
            elements.selectBanco.innerHTML = `<option value="" disabled selected>Nenhum banco cadastrado...</option>`;
            return;
        }
        
        elements.selectBanco.innerHTML = `
            <option value="" disabled selected>Selecione o banco...</option>
            ` + registeredBanks.map(bank => `<option value="${escapeHTML(bank)}">${escapeHTML(bank)}</option>`).join('');
    }

    function renderRegisteredBanksList() {
        if (registeredBanks.length === 0) {
            elements.registeredBanksList.innerHTML = `
                <div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">
                    Nenhum banco cadastrado no sistema. Vá nas configurações para adicionar.
                </div>
            `;
            return;
        }
        
        elements.registeredBanksList.innerHTML = registeredBanks.map(bank => `
            <div class="bank-tag">
                <i class="fa-solid fa-building-columns"></i>
                <span>${bank}</span>
                <button class="btn-delete-bank" data-bank="${bank}" title="Excluir banco">
                    <i class="fa-solid fa-circle-xmark"></i>
                </button>
            </div>
        `).join('');
        
        elements.registeredBanksList.querySelectorAll('.btn-delete-bank').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bankToDelete = e.currentTarget.getAttribute('data-bank');
                handleDeleteBank(bankToDelete);
            });
        });
    }

    function handleDeleteBank(bankName) {
        const isBeingUsed = activeVehicles.some(car => car.bank === bankName);
        if (isBeingUsed) {
            showToast(`Não é possível excluir o banco "${bankName}" pois existem veículos ativos associados a ele!`, 'error');
            return;
        }
        
        const confirmDelete = confirm(`Deseja realmente remover o banco "${bankName}" da lista?`);
        if (confirmDelete) {
            registeredBanks = registeredBanks.filter(b => b !== bankName);
            saveBanksToStorage();
            
            renderRegisteredBanksList();
            populateBankDropdown();
            showToast(`Banco "${bankName}" excluído com sucesso.`, 'warning');
        }
    }

    // --- Fechamento Leilão Logic ---
    function formatCurrency(value) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function openLeilaoModal(carId) {
        const car = activeVehicles.find(item => item.id === carId);
        if (!car) {
            showToast('Veículo não encontrado.', 'error');
            return;
        }
        
        currentLeilaoVehicle = car;
        
        elements.modalLeilaoPlateBadge.textContent = car.plate;
        if (isPlateMercosul(car.plate)) {
            elements.modalLeilaoPlateBadge.classList.add('badge-plate-mercosul');
        } else {
            elements.modalLeilaoPlateBadge.classList.remove('badge-plate-mercosul');
        }
        elements.modalLeilaoModelBadge.textContent = car.model;
        elements.modalLeilaoRegisteredYard.textContent = getYardNameDisplay(car.yard);
        elements.modalLeilaoRegisteredBank.textContent = car.bank;
        elements.modalLeilaoTimeEntry.textContent = formatDate(new Date(car.entryTime));
        
        // Defaults
        elements.inputLeilaoTransi.value = "0.00";
        elements.inputLeilaoEs.value = "35.00";
        elements.inputLeilaoExtras.value = "0.00";
        elements.inputLeilaoOrigem.value = "";
        elements.inputLeilaoDestino.value = "DEALERS CLUB em Suzano";
        
        // Prefill modal exit time to now
        const now = new Date();
        const localISOString = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        elements.modalLeilaoTimeExit.value = localISOString;
        
        recalculateLeilaoValues();
        
        // Open
        elements.modalLeilaoCheckout.classList.add('active');
    }

    function closeLeilaoModal() {
        elements.modalLeilaoCheckout.classList.remove('active');
        currentLeilaoVehicle = null;
    }

    function setModalLeilaoExitTimeToNow() {
        const now = new Date();
        const localISOString = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        elements.modalLeilaoTimeExit.value = localISOString;
        recalculateLeilaoValues();
        showToast('Data/Hora de saída ajustada para agora.', 'success');
    }

    function recalculateLeilaoValues() {
        if (!currentLeilaoVehicle) return;
        
        const entryTime = new Date(currentLeilaoVehicle.entryTime);
        const exitTimeVal = elements.modalLeilaoTimeExit.value;
        const exitTime = new Date(exitTimeVal);
        
        const diffMs = exitTime - entryTime;
        
        if (diffMs < 0) {
            elements.labelLeilaoDiarias.textContent = "Saída anterior à entrada!";
            elements.labelLeilaoTotalEstadias.textContent = "R$ --";
            elements.labelLeilaoTotalGeral.textContent = "R$ --";
            elements.btnConfirmLeilao.setAttribute('disabled', 'true');
            return;
        }
        
        elements.btnConfirmLeilao.removeAttribute('disabled');
        
        // Diárias: diferença de dias calendário + 1. Garante mínimo de 1.
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
        const totalDiarias = diffDays < 1 ? 1 : diffDays;
        
        const valorEs = parseFloat(elements.inputLeilaoEs.value) || 0;
        const valorTransi = parseFloat(elements.inputLeilaoTransi.value) || 0;
        const despesasExtras = parseFloat(elements.inputLeilaoExtras.value) || 0;
        
        const totalEstadias = totalDiarias * valorEs;
        const totalGeral = valorTransi + totalEstadias + despesasExtras;
        
        elements.labelLeilaoDiarias.textContent = `${totalDiarias} diária(s)`;
        elements.labelLeilaoTotalEstadias.textContent = formatCurrency(totalEstadias);
        elements.labelLeilaoTotalGeral.textContent = formatCurrency(totalGeral);
    }

    function handleConfirmLeilao() {
        if (!currentLeilaoVehicle) return;
        
        const exitTimeVal = elements.modalLeilaoTimeExit.value;
        const exitTime = new Date(exitTimeVal).toISOString();
        
        const entryTime = new Date(currentLeilaoVehicle.entryTime);
        const exitTimeObj = new Date(exitTimeVal);
        
        if (exitTimeObj - entryTime < 0) {
            showToast('Erro: A data de saída não pode ser menor que a data de entrada.', 'error');
            return;
        }

        const valorTransi = parseFloat(elements.inputLeilaoTransi.value) || 0;
        const valorEs = parseFloat(elements.inputLeilaoEs.value) || 0;
        const despesasExtras = parseFloat(elements.inputLeilaoExtras.value) || 0;
        const origem = elements.inputLeilaoOrigem.value.trim();
        const destino = elements.inputLeilaoDestino.value.trim();

        if (!origem || !destino) {
            showToast('Por favor, preencha os campos obrigatórios (Origem e Destino da Coleta).', 'warning');
            return;
        }

        const diffDays = Math.floor((exitTimeObj - entryTime) / (1000 * 60 * 60 * 24)) + 1;
        const totalDiarias = diffDays < 1 ? 1 : diffDays;
        const totalEstadias = totalDiarias * valorEs;
        const totalGeral = valorTransi + totalEstadias + despesasExtras;

        const auctionRecord = {
            id: currentLeilaoVehicle.id,
            plate: currentLeilaoVehicle.plate,
            model: currentLeilaoVehicle.model,
            valorTransi: valorTransi,
            valorEs: valorEs,
            despesasExtras: despesasExtras,
            valorTotal: totalGeral,
            yard: "RJ ASSISTENCIA VEICULAR",
            origem: origem,
            destino: destino,
            entryTime: currentLeilaoVehicle.entryTime,
            exitTime: exitTime,
            diarias: totalDiarias,
            totalEstadias: totalEstadias,
            bank: currentLeilaoVehicle.bank
        };

        // Remove from active
        activeVehicles = activeVehicles.filter(car => car.id !== currentLeilaoVehicle.id);
        
        // Add to auction history
        auctionHistory.push(auctionRecord);
        
        saveDataToStorage();
        saveAuctionDataToStorage();
        closeLeilaoModal();
        renderDashboard();
        renderLeilaoTable();
        
        showToast(`Veículo ${auctionRecord.model} (${auctionRecord.plate}) fechado e enviado para Leilão com sucesso!`, 'success');
    }

    function renderLeilaoTable() {
        const query = elements.searchLeilao.value.toLowerCase().trim();
        const filtered = auctionHistory.filter(item => 
            item.plate.toLowerCase().includes(query) || 
            item.model.toLowerCase().includes(query) ||
            item.origem.toLowerCase().includes(query) ||
            item.destino.toLowerCase().includes(query) ||
            item.yard.toLowerCase().includes(query)
        );
        
        filtered.sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime));

        if (filtered.length === 0) {
            elements.tbodyLeilao.innerHTML = `
                <tr class="empty-state-row">
                    <td colspan="13">
                        <div class="empty-state">
                            <i class="fa-solid fa-gavel"></i>
                            <p>${escapeHTML(query) ? 'Nenhum registro correspondente no leilão' : 'Nenhum veículo enviado para o leilão ainda'}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        elements.tbodyLeilao.innerHTML = filtered.map(item => {
            const entryDate = new Date(item.entryTime);
            const exitDate = new Date(item.exitTime);
            const isMercosul = isPlateMercosul(item.plate);
            
            return `
                <tr>
                    <td><span class="badge-plate ${isMercosul ? 'badge-plate-mercosul' : ''}">${escapeHTML(item.plate)}</span></td>
                    <td style="font-weight:600; color: var(--text-primary);">${escapeHTML(capitalizeWords(item.model))}</td>
                    <td>${formatCurrency(item.valorTransi)}</td>
                    <td>${formatCurrency(item.valorEs)}/dia</td>
                    <td>${formatCurrency(item.despesasExtras)}</td>
                    <td class="text-green" style="font-weight:700;">${formatCurrency(item.valorTotal)}</td>
                    <td><span class="badge-yard ${getYardClass(item.yard)}">${getYardNameDisplay(item.yard)}</span></td>
                    <td>${item.origem}</td>
                    <td>${item.destino}</td>
                    <td>${formatDate(entryDate)}</td>
                    <td>${formatDate(exitDate)}</td>
                    <td style="font-weight:600; text-align:center;">${item.diarias}</td>
                    <td style="font-weight:600; color: var(--text-primary);">${formatCurrency(item.totalEstadias)}</td>
                </tr>
            `;
        }).join('');
    }

    function filterLeilaoTable() {
        renderLeilaoTable();
    }

    function handleClearLeilao() {
        const confirmClear = confirm('Tem certeza absoluta que deseja limpar todo o histórico de leilões? Essa ação não poderá ser desfeita e apagará todos os valores financeiros registrados.');
        if (confirmClear) {
            auctionHistory = [];
            saveAuctionDataToStorage();
            renderLeilaoTable();
            showToast('O histórico de leilões foi limpo completamente.', 'warning');
        }
    }

    function handleExportLeilaoCsv() {
        if (auctionHistory.length === 0) {
            showToast('Não há registros de leilão para exportar!', 'warning');
            return;
        }

        // CSV Header
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "PLACA;MODELO;VALOR TRANSI;VALOR ES;DESPESAS EXTRAS;VALOR TOTAL;PÁTIO;ORIGEM;DESTINO;PRIMEIRA ESTADIA;ÚLTIMA ESTADIA;QUANTIDADE DE DIÁRIAS;VALOR TOTAL ESTADIAS\r\n";

        // Rows
        auctionHistory.forEach(item => {
            const entryFormatted = formatDate(new Date(item.entryTime)).replace(' - ', ' ');
            const exitFormatted = formatDate(new Date(item.exitTime)).replace(' - ', ' ');
            const yardFormatted = getYardNameDisplay(item.yard);
            
            const fmtTransi = item.valorTransi.toFixed(2).replace('.', ',');
            const fmtEs = item.valorEs.toFixed(2).replace('.', ',');
            const fmtExtras = item.despesasExtras.toFixed(2).replace('.', ',');
            const fmtTotal = item.valorTotal.toFixed(2).replace('.', ',');
            const fmtTotalEstadias = item.totalEstadias.toFixed(2).replace('.', ',');

            csvContent += `"${item.plate}";"${capitalizeWords(item.model)}";"${fmtTransi}";"${fmtEs}";"${fmtExtras}";"${fmtTotal}";"${yardFormatted}";"${item.origem}";"${item.destino}";"${entryFormatted}";"${exitFormatted}";"${item.diarias}";"${fmtTotalEstadias}"\r\n`;
        });

        // Trigger Download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const fileName = `ParkFlow_Fechamento_Leilao_${new Date().toISOString().slice(0, 10)}.csv`;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Mover veículos ativamente faturados para o histórico de embarcados
        shippedHistory = [...shippedHistory, ...auctionHistory];
        const countMoved = auctionHistory.length;
        auctionHistory = []; // Limpa o lote ativo
        
        saveAuctionDataToStorage();
        saveShippedDataToStorage();
        
        renderLeilaoTable();
        renderShippedTable();
        
        showToast(`Planilha CSV gerada! ${countMoved} veículo(s) movido(s) para Embarcados Leilão.`, 'success');
    }

    // --- Embarcados / Histórico Leilão Logic ---
    let isPopulatingFilter = false;
    function populateShippedMonthsFilter() {
        if (!elements.filterShippedMonth) return;
        if (isPopulatingFilter) return;
        
        isPopulatingFilter = true;
        const currentValue = elements.filterShippedMonth.value;
        
        const monthsMap = Object.create(null);
        
        shippedHistory.forEach(item => {
            if (!item.exitTime) return;
            const date = new Date(item.exitTime);
            if (isNaN(date.getTime())) return;
            
            const year = date.getFullYear();
            const month = date.getMonth();
            const key = `${year}-${String(month + 1).padStart(2, '0')}`;
            
            const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            monthsMap[key] = `${capitalizedMonth} de ${year}`;
        });
        
        const sortedKeys = Object.keys(monthsMap).sort().reverse();
        
        let html = `<option value="all" style="background: var(--bg-card); color: var(--text-primary);">Todos os Meses</option>`;
        sortedKeys.forEach(key => {
            html += `<option value="${key}" style="background: var(--bg-card); color: var(--text-primary);">${monthsMap[key]}</option>`;
        });
        
        elements.filterShippedMonth.innerHTML = html;
        
        if (sortedKeys.includes(currentValue)) {
            elements.filterShippedMonth.value = currentValue;
        } else {
            elements.filterShippedMonth.value = 'all';
        }
        isPopulatingFilter = false;
    }

    function updateShippedMonthsSubtitle(filteredList) {
        if (!elements.shippedAccordionTitle) return;
        
        let totalRevenue = 0;
        const monthsSet = new Set();
        
        filteredList.forEach(item => {
            totalRevenue += item.valorTotal || 0;
            if (!item.exitTime) return;
            const date = new Date(item.exitTime);
            if (isNaN(date.getTime())) return;
            
            const year = date.getFullYear();
            const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            monthsSet.add(`${capitalizedMonth} de ${year}`);
        });

        const monthsArray = Array.from(monthsSet);
        let titleText = "Lote de Embarcados";
        
        if (monthsArray.length === 0) {
            titleText = "Lote de Embarcados (Nenhum mês)";
        } else if (monthsArray.length === 1) {
            titleText = `Lote de Embarcados (${monthsArray[0]})`;
        } else {
            const last = monthsArray.pop();
            titleText = `Lote de Embarcados (${monthsArray.join(', ')} e ${last})`;
        }
        
        elements.shippedAccordionTitle.textContent = titleText;
        if (elements.shippedAccordionBadge) {
            elements.shippedAccordionBadge.textContent = `${filteredList.length} veículo(s)`;
        }
        if (elements.shippedAccordionRevenue) {
            elements.shippedAccordionRevenue.textContent = `Faturamento: ${formatCurrency(totalRevenue)}`;
        }
    }

    function renderShippedTable() {
        populateShippedMonthsFilter();
        
        const query = elements.searchShipped.value.toLowerCase().trim();
        const selectedMonthKey = elements.filterShippedMonth ? elements.filterShippedMonth.value : 'all';
        
        const filtered = shippedHistory.filter(item => {
            const matchesQuery = item.plate.toLowerCase().includes(query) || 
                                 item.model.toLowerCase().includes(query) ||
                                 item.origem.toLowerCase().includes(query) ||
                                 item.destino.toLowerCase().includes(query) ||
                                 item.yard.toLowerCase().includes(query);
                                 
            let matchesMonth = true;
            if (selectedMonthKey !== 'all') {
                const date = new Date(item.exitTime);
                if (!isNaN(date.getTime())) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const key = `${year}-${month}`;
                    matchesMonth = (key === selectedMonthKey);
                } else {
                    matchesMonth = false;
                }
            }
            
            return matchesQuery && matchesMonth;
        });
        
        filtered.sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime));

        // Atualizar a legenda e totais do botão do acordeão
        updateShippedMonthsSubtitle(filtered);

        // Controlar dinamicamente a coluna de cabeçalho "Selecionar" se estiver no modo de exclusão
        const table = document.getElementById('table-embarcados');
        if (table) {
            const headerRow = table.querySelector('thead tr');
            if (headerRow) {
                const existingCheckHeader = headerRow.querySelector('.delete-check-header');
                if (existingCheckHeader) {
                    existingCheckHeader.remove();
                }
                
                if (shippedDeleteMode) {
                    const th = document.createElement('th');
                    th.className = 'delete-check-header';
                    th.textContent = 'Excluir';
                    th.style.width = '70px';
                    th.style.textAlign = 'center';
                    headerRow.insertBefore(th, headerRow.firstChild);
                }
            }
        }

        if (filtered.length === 0) {
            const colspanVal = shippedDeleteMode ? 14 : 13;
            elements.tbodyShipped.innerHTML = `
                <tr class="empty-state-row">
                    <td colspan="${colspanVal}">
                        <div class="empty-state">
                            <i class="fa-solid fa-truck-moving"></i>
                            <p>${escapeHTML(query) || selectedMonthKey !== 'all' ? 'Nenhum registro correspondente nos embarcados' : 'Nenhum veículo embarcado para leilão ainda'}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        elements.tbodyShipped.innerHTML = filtered.map(item => {
            const entryDate = new Date(item.entryTime);
            const exitDate = new Date(item.exitTime);
            const isMercosul = isPlateMercosul(item.plate);
            
            const checkboxTd = shippedDeleteMode ? `
                <td class="delete-check-cell" style="text-align: center; width: 70px;">
                    <input type="checkbox" class="shipped-delete-checkbox" data-id="${item.id}" style="width: 18px; height: 18px; cursor: pointer;">
                </td>
            ` : '';

            return `
                <tr>
                    ${checkboxTd}
                    <td><span class="badge-plate ${isMercosul ? 'badge-plate-mercosul' : ''}">${escapeHTML(item.plate)}</span></td>
                    <td style="font-weight:600; color: var(--text-primary);">${escapeHTML(capitalizeWords(item.model))}</td>
                    <td>${formatCurrency(item.valorTransi)}</td>
                    <td>${formatCurrency(item.valorEs)}/dia</td>
                    <td>${formatCurrency(item.despesasExtras)}</td>
                    <td class="text-green" style="font-weight:700;">${formatCurrency(item.valorTotal)}</td>
                    <td><span class="badge-yard ${getYardClass(item.yard)}">${getYardNameDisplay(item.yard)}</span></td>
                    <td>${item.origem}</td>
                    <td>${item.destino}</td>
                    <td>${formatDate(entryDate)}</td>
                    <td>${formatDate(exitDate)}</td>
                    <td style="font-weight:600; text-align:center;">${item.diarias}</td>
                    <td style="font-weight:600; color: var(--text-primary);">${formatCurrency(item.totalEstadias)}</td>
                </tr>
            `;
        }).join('');
    }

    function filterShippedTable() {
        renderShippedTable();
    }

    function handleClearShipped() {
        const confirmClear = confirm('Tem certeza absoluta que deseja apagar todo o histórico de consultas de veículos embarcados? Essa ação é irreversível e limpará todas as consultas definitivas.');
        if (confirmClear) {
            shippedHistory = [];
            saveShippedDataToStorage();
            renderShippedTable();
            showToast('O histórico definitivo de embarques foi limpo.', 'warning');
        }
    }

    function handleExportShippedCsv() {
        if (shippedHistory.length === 0) {
            showToast('Não há histórico de embarcados para exportar!', 'warning');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "PLACA;MODELO;VALOR TRANSI;VALOR ES;DESPESAS EXTRAS;VALOR TOTAL;PÁTIO;ORIGEM;DESTINO;PRIMEIRA ESTADIA;ÚLTIMA ESTADIA;QUANTIDADE DE DIÁRIAS;VALOR TOTAL ESTADIAS\r\n";

        shippedHistory.forEach(item => {
            const entryFormatted = formatDate(new Date(item.entryTime)).replace(' - ', ' ');
            const exitFormatted = formatDate(new Date(item.exitTime)).replace(' - ', ' ');
            const yardFormatted = getYardNameDisplay(item.yard);
            
            const fmtTransi = item.valorTransi.toFixed(2).replace('.', ',');
            const fmtEs = item.valorEs.toFixed(2).replace('.', ',');
            const fmtExtras = item.despesasExtras.toFixed(2).replace('.', ',');
            const fmtTotal = item.valorTotal.toFixed(2).replace('.', ',');
            const fmtTotalEstadias = item.totalEstadias.toFixed(2).replace('.', ',');

            csvContent += `"${item.plate}";"${capitalizeWords(item.model)}";"${fmtTransi}";"${fmtEs}";"${fmtExtras}";"${fmtTotal}";"${yardFormatted}";"${item.origem}";"${item.destino}";"${entryFormatted}";"${exitFormatted}";"${item.diarias}";"${fmtTotalEstadias}"\r\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ParkFlow_Historico_Geral_Embarcados_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Planilha com todo o histórico de consultas de embarcados exportada!', 'success');
    }

    function handleTriggerDeleteShipped() {
        if (shippedHistory.length === 0) {
            showToast('Não há veículos no histórico para excluir!', 'warning');
            return;
        }

        if (!shippedDeleteMode) {
            // Entrar no modo de exclusão
            shippedDeleteMode = true;
            elements.btnTriggerDeleteShipped.innerHTML = `<i class="fa-solid fa-circle-check"></i> Confirmar Exclusão`;
            elements.btnTriggerDeleteShipped.style.background = 'var(--color-green-gradient)';
            elements.btnCancelDeleteShipped.style.display = 'flex';
            renderShippedTable();
            showToast('Selecione os veículos que deseja excluir nas caixas de seleção.', 'info');
        } else {
            // Confirmar exclusão
            const checkboxes = document.querySelectorAll('.shipped-delete-checkbox:checked');
            if (checkboxes.length === 0) {
                showToast('Por favor, selecione pelo menos um veículo para excluir.', 'warning');
                return;
            }

            const confirmMsg = checkboxes.length === 1 
                ? 'Você realmente deseja excluir esse veículo da lista?' 
                : `Você realmente deseja excluir os ${checkboxes.length} veículos selecionados da lista?`;
            
            const confirmDelete = confirm(confirmMsg);
            if (confirmDelete) {
                const idsToDelete = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));
                
                // Remover do histórico de embarcados
                shippedHistory = shippedHistory.filter(item => !idsToDelete.includes(item.id));
                saveShippedDataToStorage();
                
                // Sair do modo de exclusão
                exitShippedDeleteMode();
                showToast(`${idsToDelete.length} veículo(s) excluído(s) da lista com sucesso!`, 'success');
            }
        }
    }

    function handleCancelDeleteShipped() {
        exitShippedDeleteMode();
        showToast('Exclusão cancelada.', 'info');
    }

    function exitShippedDeleteMode() {
        shippedDeleteMode = false;
        elements.btnTriggerDeleteShipped.innerHTML = `<i class="fa-solid fa-trash-can"></i> Excluir Veículo`;
        elements.btnTriggerDeleteShipped.style.background = 'var(--color-orange-gradient)';
        elements.btnCancelDeleteShipped.style.display = 'none';
        renderShippedTable();
    }

    // --- Backup & Segurança Logic ---
    function checkBackupReminder() {
        const lastBackup = localStorage.getItem('parkflow_last_backup_time');
        const banner = elements.backupReminderBanner;
        if (!banner) return;
        
        if (!lastBackup) {
            banner.style.display = 'flex';
            return;
        }
        
        const lastBackupDate = new Date(lastBackup);
        const now = new Date();
        const diffTime = Math.abs(now - lastBackupDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Lembrete se o backup tiver mais de 7 dias
        if (diffDays > 7) {
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    function updateBackupLastDateLabel() {
        const lastBackup = localStorage.getItem('parkflow_last_backup_time');
        if (!elements.backupLastDateLabel) return;
        
        if (lastBackup) {
            elements.backupLastDateLabel.textContent = formatDate(new Date(lastBackup));
        } else {
            elements.backupLastDateLabel.textContent = "Nenhum backup registrado";
        }
    }

    function handleCreateBackup() {
        const backupData = {
            system: "ParkFlow",
            version: "2.0.0",
            timestamp: new Date().toISOString(),
            activeVehicles: activeVehicles,
            history: history,
            configs: configs,
            registeredBanks: registeredBanks,
            auctionHistory: auctionHistory,
            shippedHistory: shippedHistory
        };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchor = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `ParkFlow_Backup_Seguranca_${dateStr}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        
        // Salva a data do último backup
        const nowStr = new Date().toISOString();
        localStorage.setItem('parkflow_last_backup_time', nowStr);
        
        // Atualiza UI
        updateBackupLastDateLabel();
        if (elements.backupReminderBanner) {
            elements.backupReminderBanner.style.display = 'none';
        }
        
        showToast('Backup completo criado e baixado com sucesso!', 'success');
    }

    function handleBackupFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            elements.uploadFileNameHint.textContent = `Arquivo: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
            elements.btnRestoreBackup.removeAttribute('disabled');
            showToast('Arquivo carregado. Clique em "Restaurar Backup" para aplicar.', 'info');
        } else {
            elements.uploadFileNameHint.textContent = "Nenhum arquivo selecionado";
            elements.btnRestoreBackup.setAttribute('disabled', 'true');
        }
    }

    function handleRestoreBackup() {
        const file = elements.inputBackupFile.files[0];
        if (!file) return;
        
        const confirmRestore = confirm('ATENÇÃO: A restauração do backup substituirá permanentemente todos os veículos ativos, históricos de saídas comuns, listas de bancos cadastrados, lotes de leilões e embarcados atuais pelos dados contidos no arquivo selecionado. Tem certeza de que deseja restaurar esses dados?');
        if (!confirmRestore) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validação de segurança básica do arquivo de backup
                if (data.system !== "ParkFlow" || !data.activeVehicles) {
                    showToast('Erro: O arquivo selecionado não é um arquivo de backup válido do ParkFlow!', 'error');
                    return;
                }
                
                // Restaura cada uma das variáveis de estado no localStorage
                localStorage.setItem('parkflow_active_yards', JSON.stringify(data.activeVehicles || []));
                localStorage.setItem('parkflow_history_yards', JSON.stringify(data.history || []));
                localStorage.setItem('parkflow_configs_yards', JSON.stringify(data.configs || { capRoberto: 15, capTerreno: 25, capBarracao: 10 }));
                localStorage.setItem('parkflow_registered_banks', JSON.stringify(data.registeredBanks || ['Volkswagen', 'Mercado Pago', 'GM', 'C6 Bank']));
                localStorage.setItem('parkflow_auction_history', JSON.stringify(data.auctionHistory || []));
                localStorage.setItem('parkflow_shipped_history', JSON.stringify(data.shippedHistory || []));
                
                // Salva o momento da restauração como último backup também por segurança
                localStorage.setItem('parkflow_last_backup_time', new Date().toISOString());
                
                showToast('Backup restaurado com sucesso! Recarregando sistema...', 'success');
                
                // Recarrega a página após 1,5 segundos para aplicar tudo limpo
                setTimeout(() => {
                    location.reload();
                }, 1500);
                
            } catch (err) {
                showToast('Erro ao ler ou processar o arquivo de backup. Certifique-se de que é um arquivo .json íntegro.', 'error');
            }
        };
        reader.readAsText(file);
    }

    // --- CSV File Import (Embarcados) ---
    elements.btnTriggerUploadCsv.addEventListener('click', () => {
        elements.inputImportCsv.click();
    });

    elements.inputImportCsv.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            elements.uploadCsvNameHint.textContent = `Arquivo selecionado: ${file.name}`;
            elements.uploadCsvNameHint.style.color = 'var(--color-purple)';
            elements.btnConfirmImportCsv.removeAttribute('disabled');
        } else {
            elements.uploadCsvNameHint.textContent = 'Nenhuma planilha selecionada';
            elements.uploadCsvNameHint.style.color = '';
            elements.btnConfirmImportCsv.setAttribute('disabled', 'true');
        }
    });

    // --- CSV Fast Active Import (Temporário) ---
    elements.btnHideImportCard.addEventListener('click', () => {
        elements.cardImportAtivos.style.display = 'none';
    });

    elements.btnTriggerUploadAtivosCsv.addEventListener('click', () => {
        elements.inputImportAtivosCsv.click();
    });

    elements.selectImportPatio.addEventListener('change', () => {
        if (elements.inputImportAtivosCsv.files.length > 0 && elements.selectImportPatio.value) {
            elements.btnConfirmImportAtivosCsv.removeAttribute('disabled');
        } else {
            elements.btnConfirmImportAtivosCsv.setAttribute('disabled', 'true');
        }
    });

    elements.inputImportAtivosCsv.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            elements.uploadAtivosCsvNameHint.textContent = `Arquivo: ${file.name}`;
            elements.uploadAtivosCsvNameHint.style.color = 'var(--color-blue)';
            if (elements.selectImportPatio.value) {
                elements.btnConfirmImportAtivosCsv.removeAttribute('disabled');
            }
        } else {
            elements.uploadAtivosCsvNameHint.textContent = 'Nenhuma planilha selecionada';
            elements.uploadAtivosCsvNameHint.style.color = '';
            elements.btnConfirmImportAtivosCsv.setAttribute('disabled', 'true');
        }
    });

    elements.btnConfirmImportAtivosCsv.addEventListener('click', () => {
        const file = elements.inputImportAtivosCsv.files[0];
        const patio = elements.selectImportPatio.value;
        if (!file || !patio) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            const rows = text.split(/\r?\n/);
            let importedCount = 0;
            
            // Assuming headers are on row 0, data starts at row 1
            for (let i = 1; i < rows.length; i++) {
                const rowStr = rows[i];
                if (!rowStr.trim()) continue;
                const cols = rowStr.split(';');
                if (cols.length >= 2) { 
                    const plate = cols[0].trim().toUpperCase();
                    const model = cols[1].trim();
                    const bank = cols.length > 2 ? cols[2].trim() : 'N/A';
                    
                    const entry = {
                        id: 'car_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
                        plate: plate,
                        model: model,
                        yard: patio,
                        bank: bank || 'N/A',
                        entryTime: new Date().toISOString()
                    };
                    activeVehicles.push(entry);
                    importedCount++;
                }
            }
            
            saveData();
            updateDashboardUI();
            if (isSupabaseActive) syncActiveToSupabase();
            showToast(`${importedCount} veículos importados com sucesso para o ${patio}!`, 'success');
            
            // Reset form
            elements.inputImportAtivosCsv.value = '';
            elements.uploadAtivosCsvNameHint.textContent = 'Nenhuma planilha selecionada';
            elements.uploadAtivosCsvNameHint.style.color = '';
            elements.selectImportPatio.value = '';
            elements.btnConfirmImportAtivosCsv.setAttribute('disabled', 'true');
        };
        reader.readAsText(file);
    });

    // --- CSV Import & Parsing Logic ---
    function handleImportCsvSelect(e) {
        const file = e.target.files[0];
        if (file) {
            elements.uploadCsvNameHint.textContent = `Planilha: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
            elements.btnConfirmImportCsv.removeAttribute('disabled');
            showToast('Planilha carregada. Clique em "Carregar Lote na Tabela" para processar.', 'info');
        } else {
            elements.uploadCsvNameHint.textContent = "Nenhuma planilha selecionada";
            elements.btnConfirmImportCsv.setAttribute('disabled', 'true');
        }
    }

    function handleConfirmImportCsv() {
        const file = elements.inputImportCsv.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const text = e.target.result;
                processCsvImport(text);
            } catch (err) {
                showToast('Erro ao ler a planilha. Verifique se o arquivo está íntegro.', 'error');
            }
        };
        // Lendo com codificação ISO-8859-1 (Latin1) para suportar caracteres acentuados do Excel BR
        reader.readAsText(file, 'ISO-8859-1');
    }

    function parseBrazilianNumber(valStr) {
        if (!valStr) return 0.0;
        let clean = valStr.toString().replace(/R\$\s?/i, '').trim();
        // Remove pontos de milhar se houver vírgula decimal depois
        if (clean.includes('.') && clean.includes(',')) {
            clean = clean.replace(/\./g, '');
        }
        // Substitui a vírgula decimal por ponto
        clean = clean.replace(',', '.');
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? 0.0 : parsed;
    }

    function parseBrazilianDate(dateStr) {
        if (!dateStr) return new Date().toISOString();
        let clean = dateStr.trim();
        
        // Padrão DD/MM/AAAA HH:MM:SS ou DD/MM/AAAA HH:MM ou DD/MM/AAAA
        const brDatePattern = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;
        const match = clean.match(brDatePattern);
        
        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // 0-indexed no JS
            const year = parseInt(match[3], 10);
            const hours = match[4] ? parseInt(match[4], 10) : 0;
            const minutes = match[5] ? parseInt(match[5], 10) : 0;
            const seconds = match[6] ? parseInt(match[6], 10) : 0;
            
            const dateObj = new Date(year, month, day, hours, minutes, seconds);
            return dateObj.toISOString();
        }
        
        const parsed = Date.parse(clean);
        if (!isNaN(parsed)) {
            return new Date(parsed).toISOString();
        }
        
        return new Date().toISOString();
    }

    function processCsvImport(text) {
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length < 2) {
            showToast('Erro: A planilha deve conter um cabeçalho e pelo menos uma linha de dados!', 'error');
            return;
        }

        // Divide campos pelo delimitador ponto e vírgula
        const headerFields = lines[0].split(';').map(field => field.replace(/^["']|["']$/g, '').trim().toUpperCase());
        
        // Localiza índices dinamicamente suportando variações de nome do cabeçalho
        const getIdx = (patterns) => {
            return headerFields.findIndex(field => 
                patterns.some(pattern => field.includes(pattern) || pattern === field)
            );
        };

        const idxPlate = getIdx(['PLACA']);
        const idxModel = getIdx(['MODELO', 'VEICULO', 'VEÍCULO']);
        const idxValTransi = getIdx(['VALOR TRANSI', 'TRANSITO', 'TRÂNSITO', 'FRETE', 'GUINCHO']);
        const idxValEs = getIdx(['VALOR ES', 'VALOR ESTADIA', 'VALOR DIARIA', 'ESTADIA', 'DIARIA']);
        const idxDespesasExtras = getIdx(['DESPESAS EXTRAS', 'EXTRA', 'DESPESA']);
        const idxValTotal = getIdx(['VALOR TOTAL', 'TOTAL']);
        const idxYard = getIdx(['PATIO', 'PÁTIO']);
        const idxOrigem = getIdx(['ORIGEM']);
        const idxDestino = getIdx(['DESTINO']);
        const idxEntryTime = getIdx(['PRIMEIRA ESTADIA', 'PRIMEIRA', 'ENTRADA', 'DATA ENTRADA']);
        const idxExitTime = getIdx(['ÚLTIMA ESTADIA', 'ULTIMA ESTADIA', 'SAIDA', 'SAÍDA', 'DATA SAIDA']);
        const idxDiarias = getIdx(['QUANTIDADE DE DIÁRIAS', 'QUANTIDADE DE DIARIAS', 'DIARIAS', 'DIAS']);
        const idxTotalEstadias = getIdx(['VALOR TOTAL ESTADIAS', 'TOTAL ESTADIAS']);

        // Valida colunas estruturais mínimas
        if (idxPlate === -1 || idxModel === -1) {
            showToast('Erro: Não foi possível identificar as colunas essenciais PLACA e MODELO no cabeçalho!', 'error');
            return;
        }

        let importedRecords = [];
        let skippedRows = 0;

        for (let i = 1; i < lines.length; i++) {
            const rowStr = lines[i];
            const rowFields = rowStr.split(';').map(field => field.replace(/^["']|["']$/g, '').trim());
            
            const plateRaw = idxPlate < rowFields.length ? rowFields[idxPlate] : '';
            const modelRaw = idxModel < rowFields.length ? rowFields[idxModel] : '';
            
            if (!plateRaw || !modelRaw) {
                skippedRows++;
                continue;
            }

            let plate = plateRaw.toUpperCase().replace(/[^A-Z0-9]/g, '');
            plate = formatPlateForDisplay(plate);
            const model = capitalizeWords(modelRaw);

            const valorTransi = idxValTransi !== -1 && idxValTransi < rowFields.length ? parseBrazilianNumber(rowFields[idxValTransi]) : 0.0;
            const valorEs = idxValEs !== -1 && idxValEs < rowFields.length ? parseBrazilianNumber(rowFields[idxValEs]) : 0.0;
            const despesasExtras = idxDespesasExtras !== -1 && idxDespesasExtras < rowFields.length ? parseBrazilianNumber(rowFields[idxDespesasExtras]) : 0.0;
            
            const entryTimeStr = idxEntryTime !== -1 && idxEntryTime < rowFields.length ? rowFields[idxEntryTime] : '';
            const exitTimeStr = idxExitTime !== -1 && idxExitTime < rowFields.length ? rowFields[idxExitTime] : '';
            
            const entryTime = parseBrazilianDate(entryTimeStr);
            const exitTime = parseBrazilianDate(exitTimeStr);

            let diarias = idxDiarias !== -1 && idxDiarias < rowFields.length ? parseInt(rowFields[idxDiarias], 10) : 0;
            if (isNaN(diarias) || diarias <= 0) {
                const entryDate = new Date(entryTime);
                const exitDate = new Date(exitTime);
                const diffMs = exitDate - entryDate;
                if (!isNaN(diffMs) && diffMs >= 0) {
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
                    diarias = diffDays < 1 ? 1 : diffDays;
                } else {
                    diarias = 1;
                }
            }

            let totalEstadias = idxTotalEstadias !== -1 && idxTotalEstadias < rowFields.length ? parseBrazilianNumber(rowFields[idxTotalEstadias]) : 0.0;
            if (totalEstadias <= 0 && valorEs > 0) {
                totalEstadias = diarias * valorEs;
            }

            let valorTotal = idxValTotal !== -1 && idxValTotal < rowFields.length ? parseBrazilianNumber(rowFields[idxValTotal]) : 0.0;
            if (valorTotal <= 0) {
                valorTotal = valorTransi + totalEstadias + despesasExtras;
            }

            const yard = idxYard !== -1 && idxYard < rowFields.length && rowFields[idxYard] ? rowFields[idxYard] : "RJ ASSISTENCIA VEICULAR";
            const origem = idxOrigem !== -1 && idxOrigem < rowFields.length && rowFields[idxOrigem] ? rowFields[idxOrigem] : "RJ ASSISTENCIA VEICULAR";
            const destino = idxDestino !== -1 && idxDestino < rowFields.length && rowFields[idxDestino] ? rowFields[idxDestino] : "DEALERS CLUB em Suzano";

            const record = {
                id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                plate,
                model,
                valorTransi,
                valorEs,
                despesasExtras,
                valorTotal,
                yard,
                origem: origem.trim(),
                destino: destino.trim(),
                entryTime,
                exitTime,
                diarias,
                totalEstadias,
                bank: "--"
            };

            importedRecords.push(record);
        }

        if (importedRecords.length === 0) {
            showToast('Nenhum registro válido importado. Verifique os dados da planilha.', 'warning');
            return;
        }

        // Adiciona de forma incremental ao histórico de embarcados
        shippedHistory = [...shippedHistory, ...importedRecords];
        saveShippedDataToStorage();

        // Atualiza a listagem
        renderShippedTable();

        // Muda automaticamente para a aba de embarcados para exibir os dados carregados
        switchTab('embarcados');

        // Limpa o formulário de upload
        elements.inputImportCsv.value = '';
        elements.uploadCsvNameHint.textContent = "Nenhuma planilha selecionada";
        elements.btnConfirmImportCsv.setAttribute('disabled', 'true');

        let msg = `${importedRecords.length} veículos importados com sucesso para o Histórico de Embarques!`;
        if (skippedRows > 0) {
            msg += ` (${skippedRows} linha(s) ignorada(s) por falta de Placa/Modelo).`;
        }
        showToast(msg, 'success');
    }

    // --- Init App ---
    init();
});
