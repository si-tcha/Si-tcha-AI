import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL est requise.');
    const url = new URL(databaseUrl);
    if (url.hostname.endsWith('.render.com') && !url.searchParams.has('sslmode')) {
        url.searchParams.set('sslmode', 'verify-full');
    }
    const client = new Client({ connectionString: url.toString() });
    try {
    await client.connect();
    // Ce seed est indépendant du client Prisma généré sur la branche locale.
    const { rows: columns } = await client.query<{
        data_type: string; column_default: string | null; is_identity: string;
    }>(`SELECT data_type, column_default, is_identity
        FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
        ['BassinProduction', 'id']);
    const id = columns[0];
    if (!id) throw new Error('Table BassinProduction ou colonne id introuvable.');
    const databaseGeneratesId = id.column_default !== null || id.is_identity === 'YES';
    if (!databaseGeneratesId && !['text', 'character varying', 'uuid'].includes(id.data_type)) {
        throw new Error(`Type id non pris en charge sans valeur par défaut : ${id.data_type}`);
    }
    console.log(`Cible : ${url.hostname}${url.pathname} (id : ${id.data_type})`);
    console.log('🚀 Démarrage du script de seeding des bassins de production...');

    const bassins = [
        {
            nom: 'Bassin des hauts plateaux de l\'Ouest',
            region: 'Ouest',
            latitude: 5.47,
            longitude: 10.42,
        },
        {
            nom: 'Bassin des forêts humides (monomodale)',
            region: 'Littoral',
            latitude: 4.05,
            longitude: 9.70,
        },
        {
            nom: 'Bassin des forêts humides (bimodale)',
            region: 'Centre',
            latitude: 3.84,
            longitude: 11.50,
        },
        {
            nom: 'Bassin des savanes guinéennes',
            region: 'Adamaoua',
            latitude: 7.32,
            longitude: 13.58,
        },
        {
            nom: 'Bassin soudano-sahélien',
            region: 'Extrême-Nord',
            latitude: 10.59,
            longitude: 14.32,
        },
    ];

    await client.query('BEGIN');
    try {
        for (const bassin of bassins) {
            const values = [bassin.nom, bassin.region, bassin.latitude, bassin.longitude];
            if (databaseGeneratesId) {
                await client.query(`INSERT INTO "BassinProduction" (nom, region, latitude, longitude)
                    VALUES ($1, $2, $3, $4) ON CONFLICT (nom) DO NOTHING`, values);
            } else {
                await client.query(`INSERT INTO "BassinProduction" (nom, region, latitude, longitude, id)
                    VALUES ($1, $2, $3, $4, $5) ON CONFLICT (nom) DO NOTHING`, [...values, randomUUID()]);
            }
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    for (const bassin of bassins) console.log(`✅ Bassin "${bassin.nom}" créé/vérifié.`);

    console.log('\n🎉 Seeding des bassins de production terminé avec succès.');
    } finally {
        await client.end();
    }
}

main()
    .catch((e) => {
        console.error("❌ Échec du seed :", e instanceof Error ? e.message : 'Erreur inconnue');
        process.exitCode = 1;
    });
