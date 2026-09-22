import prisma from './src/lib/prisma'; prisma.otpCode.findUnique({where: {phone: '+237690000000'}}).then(console.log).finally(() => prisma.$disconnect());
