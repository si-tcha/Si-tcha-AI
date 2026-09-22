import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  // Check duplicate contacts in Acheteur
  const dupAcheteurs = await client.query(`
    SELECT contact, COUNT(*) as cnt
    FROM "Acheteur"
    GROUP BY contact
    HAVING COUNT(*) > 1
  `);
  console.log('=== Doublons Acheteur ===');
  console.log(dupAcheteurs.rows.length ? dupAcheteurs.rows : 'Aucun doublon');

  // Check duplicate contacts in Agriculteur
  const dupAgriculteurs = await client.query(`
    SELECT contact, COUNT(*) as cnt
    FROM "Agriculteur"
    GROUP BY contact
    HAVING COUNT(*) > 1
  `);
  console.log('\n=== Doublons Agriculteur ===');
  console.log(dupAgriculteurs.rows.length ? dupAgriculteurs.rows : 'Aucun doublon');

  // Show all records for context
  const allAcheteurs = await client.query(`SELECT id, "nomEntreprise", contact FROM "Acheteur" ORDER BY id`);
  console.log('\n=== Tous les Acheteurs ===');
  console.log(allAcheteurs.rows);

  const allAgriculteurs = await client.query(`SELECT id, nom, contact, "estLeader", "gicId" FROM "Agriculteur" ORDER BY id`);
  console.log('\n=== Tous les Agriculteurs ===');
  console.log(allAgriculteurs.rows);

  await client.end();
}

main().catch(console.error);
