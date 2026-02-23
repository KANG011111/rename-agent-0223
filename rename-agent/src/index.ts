import { createInterface } from 'readline';
import { RenameAgent } from './agent';

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

const main = async () => {
    rl.question('請輸入 SLUG: ', async (slug) => {
        const agent = new RenameAgent();
        await agent.renameFiles(slug);
        rl.close();
    });
};

main();