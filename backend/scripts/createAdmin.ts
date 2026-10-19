import bcrypt from 'bcrypt';
import prisma from '../src/lib/prisma';

function requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`La variable d'environnement ${name} est requise.`);
    }
    return value;
}

async function main() {
    if (process.env.CONFIRM_CREATE_ADMIN !== 'CREATE_ADMIN') {
        throw new Error('Définissez CONFIRM_CREATE_ADMIN=CREATE_ADMIN pour confirmer la création.');
    }

    const nom = requiredEnv('ADMIN_NAME');
    const contact = requiredEnv('ADMIN_CONTACT');
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
        throw new Error("La variable d'environnement ADMIN_PASSWORD est requise.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.admin.create({
        data: {
            nom,
            contact,
            password: hashedPassword,
        },
    });

    console.log(`Administrateur "${nom}" créé avec succès.`);
}

try {
    await main();
} catch (error) {
    console.error("Échec de la création de l'administrateur :", error);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
