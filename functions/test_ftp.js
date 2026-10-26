const ftp = require('basic-ftp');

async function testFTP() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    
    console.log("Probando con www.gestion-eficaz.com ...");
    try {
        await client.access({
            host: "www.gestion-eficaz.com",
            user: "2385- BEACHCLUB",
            password: "7KjMo4#B@7",
            secure: false
        });
        console.log("Conectado exitosamente con www.gestion-eficaz.com!");
        client.close();
        return;
    } catch (e) {
        console.error("Fallo www: ", e.message);
    }
    
    console.log("\nProbando con ftp.gestion-eficaz.com ...");
    try {
        await client.access({
            host: "ftp.gestion-eficaz.com",
            user: "2385- BEACHCLUB",
            password: "7KjMo4#B@7",
            secure: false
        });
        console.log("Conectado exitosamente con ftp.gestion-eficaz.com!");
        client.close();
        return;
    } catch (e) {
        console.error("Fallo ftp: ", e.message);
    }
    
    console.log("\nProbando quitando el espacio en el usuario ...");
    try {
        await client.access({
            host: "www.gestion-eficaz.com",
            user: "2385-BEACHCLUB",
            password: "7KjMo4#B@7",
            secure: false
        });
        console.log("Conectado exitosamente sin espacio!");
        client.close();
        return;
    } catch (e) {
        console.error("Fallo sin espacio: ", e.message);
    }
    
    console.log("\nProbando con minúsculas ...");
    try {
        await client.access({
            host: "www.gestion-eficaz.com",
            user: "2385- beachclub",
            password: "7KjMo4#B@7",
            secure: false
        });
        console.log("Conectado exitosamente en minusculas!");
        client.close();
        return;
    } catch (e) {
        console.error("Fallo minusculas: ", e.message);
    }
}

testFTP();
