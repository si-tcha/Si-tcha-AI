import 'dotenv/config';
import bcrypt from 'bcrypt';
import prisma from '../src/lib/prisma.js';

const REQUIRED_CONFIRMATION = 'CREATE_ADMIN';
const PASSWORD_MIN_LENGTH = 12;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variable obligatoire absente : ${name}`);
  }
  return value;
}

async function main() {
  if (process.env.CONFIRM_CREATE_ADMIN !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `Opération annulée. Définissez CONFIRM_CREATE_ADMIN=${REQUIRED_CONFIRMATION} pour créer un agent.`
    );
  }

  const name = required('ADMIN_NAME');
  const contact = required('ADMIN_CONTACT');
  const password = required('ADMIN_PASSWORD');

  if (name.length < 3 || name.length > 100) {
    throw new Error('ADMIN_NAME doit contenir entre 3 et 100 caractères.');
  }
  if (contact.length < 3 || contact.length > 100) {
    throw new Error('ADMIN_CONTACT est invalide.');
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`ADMIN_PASSWORD doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`);
  }

  const existing = await prisma.admin.findFirst({
    where: { OR: [{ nom: name }, { contact }] },
    select: { id: true },
  });

  if (existing) {
    throw new Error('Un agent existe déjà avec ce nom ou ce contact. Aucune modification effectuée.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.admin.create({
    data: { nom: name, contact, password: passwordHash },
  });

  console.log(`Agent créé avec succès : ${name}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Échec de création de l’agent.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
