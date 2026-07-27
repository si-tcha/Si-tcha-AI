import axios from 'axios';
// --- CONFIGURATION ---
const API_BASE_URL = 'http://localhost:8080/api'; // Assurez-vous que le port est correct
// Données de test uniques pour éviter les conflits
const testRunId = Date.now();
const agriculteurTest = {
    nom: `TestAgri_${testRunId}`,
    contact: `+2376${String(testRunId).slice(-8)}`, // Numéro de téléphone unique
    gicId: '', // Sera rempli après avoir récupéré les GICs
};
const acheteurTest = {
    nom: `TestBuyer_${testRunId}`,
    nomEntreprise: `BuyerCorp_${testRunId}`,
    nui: `NUI${testRunId}`,
    secteur_activite: 'Achat de test',
    contact: `+2376${String(testRunId + 1).slice(-8)}`, // Numéro de téléphone unique
};
// --- VARIABLES À REMPLIR MANUELLEMENT ---
// Après la première exécution (avec `run`), copiez/collez les codes de la console du backend ici.
const agriculteurVerificationCode = '665684'; // <--- À REMPLIR
const acheteurVerificationCode = '939975'; // <--- À REMPLIR
// --- FONCTIONS D'AIDE ---
const logStep = (step, description) => console.log(`\n--- ÉTAPE ${step}: ${description} ---`);
const logSuccess = (message, data) => console.log(`✅ SUCCÈS: ${message}`, data ? JSON.stringify(data, null, 2) : '');
const logError = (message, error) => console.error(`❌ ERREUR: ${message}`, error?.response?.data || error?.message || '');
const logInfo = (message) => console.log(`\nℹ️  ${message}`);
// --- SCRIPTS DE TEST ---
/**
 * Étape 1: Enregistrement des utilisateurs.
 */
async function runRegistration() {
    try {
        logStep(1, 'Récupération de la liste des GICs');
        const gicResponse = await axios.get(`${API_BASE_URL}/gics`);
        const gics = gicResponse.data;
        if (gics.length === 0) {
            throw new Error("Aucun GIC trouvé. Veuillez exécuter le script 'seed-gic.ts' d'abord.");
        }
        agriculteurTest.gicId = gics[0].id;
        logSuccess('GICs récupérés. Utilisation du GIC ID:', agriculteurTest.gicId);
        logStep(2, `Enregistrement d'un nouvel agriculteur (${agriculteurTest.contact})`);
        await axios.post(`${API_BASE_URL}/auth/register/agriculteur`, agriculteurTest);
        logSuccess('Enregistrement agriculteur initié.');
        logStep(3, `Enregistrement d'un nouvel acheteur (${acheteurTest.contact})`);
        await axios.post(`${API_BASE_URL}/auth/register/acheteur`, acheteurTest);
        logSuccess('Enregistrement acheteur initié.');
        logInfo(`🛑 ACTION REQUISE:
    1. Regardez la console de votre serveur backend.
    2. Trouvez les codes de vérification pour ${agriculteurTest.contact} et ${acheteurTest.contact}.
    3. Copiez-les dans les variables 'agriculteurVerificationCode' et 'acheteurVerificationCode' de ce script.
    4. Lancez à nouveau ce script avec la commande 'verify'.`);
    }
    catch (error) {
        logError("Le test a échoué à l'étape d'enregistrement.", error);
    }
}
/**
 * Étape 2: Vérification des comptes et première tentative de login.
 */
async function runVerification() {
    if (!agriculteurVerificationCode || !acheteurVerificationCode) {
        return logError("Les codes de vérification ne sont pas définis. Veuillez exécuter l'étape 'run' d'abord et remplir les codes.");
    }
    try {
        logStep(4, `Vérification du compte agriculteur avec le code ${agriculteurVerificationCode}`);
        const verifyAgriResponse = await axios.post(`${API_BASE_URL}/auth/verify`, { contact: agriculteurTest.contact, code: agriculteurVerificationCode });
        logSuccess('Compte agriculteur vérifié.', verifyAgriResponse.data);
        logStep(5, `Vérification du compte acheteur avec le code ${acheteurVerificationCode}`);
        const verifyAcheteurResponse = await axios.post(`${API_BASE_URL}/auth/verify`, { contact: acheteurTest.contact, code: acheteurVerificationCode });
        logSuccess('Compte acheteur vérifié.', verifyAcheteurResponse.data);
        logStep(6, "Tentative de connexion de l'agriculteur (doit échouer car 'EN_ATTENTE')");
        try {
            await axios.post(`${API_BASE_URL}/auth/login`, { nom: agriculteurTest.nom, contact: agriculteurTest.contact });
        }
        catch (error) {
            if (error.response?.status === 403) {
                logSuccess("La connexion a bien échoué comme prévu avec le statut 403.", error.response.data);
            }
            else {
                throw new Error("La connexion de l'agriculteur non approuvé n'a pas échoué comme prévu.");
            }
        }
        logInfo(`🛑 ACTION REQUISE:
    1. Approuvez l'agriculteur avec le contact ${agriculteurTest.contact}.
    2. Vous pouvez utiliser Prisma Studio ('npx prisma studio'), trouver l'agriculteur et changer son 'statut' de 'EN_ATTENTE' à 'APPROUVE'.
    3. Lancez à nouveau ce script avec la commande 'login'.`);
    }
    catch (error) {
        logError("Le test a échoué pendant la vérification.", error);
    }
}
/**
 * Étape 3: Connexion finale.
 */
async function runFinalLogin() {
    try {
        logStep(7, "Connexion de l'agriculteur (doit réussir)");
        const loginAgriResponse = await axios.post(`${API_BASE_URL}/auth/login`, { nom: agriculteurTest.nom, contact: agriculteurTest.contact });
        logSuccess("Connexion de l'agriculteur réussie.", { token: 'JWT_reçu', user: loginAgriResponse.data.user });
        logStep(8, "Connexion de l'acheteur (doit réussir)");
        const loginAcheteurResponse = await axios.post(`${API_BASE_URL}/auth/login`, { nom: acheteurTest.nom, contact: acheteurTest.contact });
        logSuccess("Connexion de l'acheteur réussie.", { token: 'JWT_reçu', user: loginAcheteurResponse.data.user });
        logStep(9, 'Test de la déconnexion');
        const logoutResponse = await axios.post(`${API_BASE_URL}/auth/logout`);
        logSuccess('Endpoint de déconnexion appelé avec succès.', logoutResponse.data);
        console.log("\n🎉🎉🎉 Tous les tests d'API ont été exécutés avec succès ! 🎉🎉🎉");
    }
    catch (error) {
        logError("Le test a échoué lors des dernières étapes de connexion.", error);
    }
}
// --- EXÉCUTION DU SCRIPT ---
const command = process.argv[2];
if (command === 'run') {
    runRegistration();
}
else if (command === 'verify') {
    runVerification();
}
else if (command === 'login') {
    runFinalLogin();
}
else {
    console.log(`
Usage: npx tsx ./scripts/test-api.ts [commande]

Commandes:
  run     : Lance l'enregistrement des utilisateurs et demande les codes de vérification.
  verify  : Vérifie les comptes et demande l'approbation manuelle de l'agriculteur.
  login   : Tente la connexion finale pour les deux utilisateurs.
`);
}
