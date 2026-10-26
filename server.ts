import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'coupons_db.json');

// Interface para os dados persistidos no servidor
interface ServerDatabase {
  customers: any[];
  coupons: any[];
  settings: any | null;
  nextNumber: number;
  lastUpdated: string;
}

// Garante que o diretório de dados exista
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inicializa ou carrega o banco de dados do arquivo JSON
function getDatabase(): ServerDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      return {
        customers: Array.isArray(data.customers) ? data.customers : [],
        coupons: Array.isArray(data.coupons) ? data.coupons : [],
        settings: data.settings || null,
        nextNumber: typeof data.nextNumber === 'number' ? data.nextNumber : 1,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error('[Server DB] Erro ao ler banco de dados do arquivo, reiniciando limpo:', err);
  }

  const initialDB: ServerDatabase = {
    customers: [],
    coupons: [],
    settings: null,
    nextNumber: 1,
    lastUpdated: new Date().toISOString(),
  };
  saveDatabase(initialDB);
  return initialDB;
}

// Salva os dados de forma atômica no arquivo físico para segurança total contra perda
function saveDatabase(db: ServerDatabase): void {
  try {
    db.lastUpdated = new Date().toISOString();
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[Server DB] Erro crítico ao gravar banco de dados:', err);
  }
}

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ==========================================
  // ROTAS DA API DE PERSISTÊNCIA NO SERVIDOR
  // ==========================================

  // Status de saúde e métricas do servidor
  app.get('/api/health', (_req: Request, res: Response) => {
    const db = getDatabase();
    res.json({
      status: 'online',
      message: 'Servidor de cupons Loja SJ operacional',
      storageFile: DB_FILE,
      totalCustomers: db.customers.length,
      totalCoupons: db.coupons.length,
      nextNumber: db.nextNumber,
      lastUpdated: db.lastUpdated,
    });
  });

  // Retorna todos os dados armazenados no servidor
  app.get('/api/data', (_req: Request, res: Response) => {
    try {
      const db = getDatabase();
      res.json({
        success: true,
        customers: db.customers,
        coupons: db.coupons,
        settings: db.settings,
        nextNumber: db.nextNumber,
        lastUpdated: db.lastUpdated,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Salva ou atualiza um cliente no servidor
  app.post('/api/customers', (req: Request, res: Response) => {
    try {
      const { customer } = req.body;
      if (!customer || !customer.cpf) {
        return res.status(400).json({ success: false, error: 'Dados do cliente ou CPF ausentes.' });
      }

      const db = getDatabase();
      const existingIdx = db.customers.findIndex((c: any) => c.cpf === customer.cpf);

      if (existingIdx >= 0) {
        db.customers[existingIdx] = {
          ...db.customers[existingIdx],
          ...customer,
          updatedAt: new Date().toISOString(),
        };
      } else {
        db.customers.unshift({
          ...customer,
          createdAt: customer.createdAt || new Date().toISOString(),
        });
      }

      saveDatabase(db);
      res.json({
        success: true,
        message: 'Cliente salvo com sucesso no servidor!',
        customer,
        totalCustomers: db.customers.length,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Salva lote de cupons e atualiza numeração sequencial atômica
  app.post('/api/coupons', (req: Request, res: Response) => {
    try {
      const { newCoupons, customer } = req.body;
      if (!Array.isArray(newCoupons) || newCoupons.length === 0) {
        return res.status(400).json({ success: false, error: 'Lista de cupons vazia ou inválida.' });
      }

      const db = getDatabase();

      // Atualiza cliente associado se fornecido
      if (customer && customer.cpf) {
        const cIdx = db.customers.findIndex((c: any) => c.cpf === customer.cpf);
        if (cIdx >= 0) {
          db.customers[cIdx] = { ...db.customers[cIdx], ...customer };
        } else {
          db.customers.unshift(customer);
        }
      }

      // Adiciona novos cupons no topo
      db.coupons = [...newCoupons, ...db.coupons];

      // Atualiza próximo número com base no maior número emitido
      const maxNumber = db.coupons.reduce(
        (max: number, c: any) => Math.max(max, Number(c.number) || 0),
        0
      );
      db.nextNumber = Math.max(db.nextNumber, maxNumber + 1);

      saveDatabase(db);

      res.json({
        success: true,
        message: `${newCoupons.length} cupons salvos com sucesso no servidor!`,
        totalCoupons: db.coupons.length,
        nextNumber: db.nextNumber,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Valida e registra a impressão dos cupons no servidor
  app.post('/api/coupons/mark-printed', (req: Request, res: Response) => {
    try {
      const { couponIds, timestamp } = req.body;
      if (!Array.isArray(couponIds) || couponIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Lista de IDs ausente.' });
      }

      const printTime = timestamp || new Date().toISOString();
      const db = getDatabase();
      let updatedCount = 0;

      db.coupons = db.coupons.map((c: any) => {
        if (couponIds.includes(c.id)) {
          updatedCount++;
          return {
            ...c,
            printedAt: c.printedAt || printTime,
          };
        }
        return c;
      });

      saveDatabase(db);

      res.json({
        success: true,
        message: `${updatedCount} cupons validados como impressos com sucesso no servidor.`,
        printedCount: updatedCount,
        printedAt: printTime,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Atualiza configurações da campanha
  app.put('/api/settings', (req: Request, res: Response) => {
    try {
      const { settings } = req.body;
      if (!settings) {
        return res.status(400).json({ success: false, error: 'Configurações ausentes.' });
      }

      const db = getDatabase();
      db.settings = settings;
      saveDatabase(db);

      res.json({
        success: true,
        message: 'Configurações salvas no servidor.',
        settings: db.settings,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Reset do banco de dados no servidor
  app.post('/api/reset', (_req: Request, res: Response) => {
    try {
      const db = getDatabase();
      db.customers = [];
      db.coupons = [];
      db.nextNumber = 1;
      saveDatabase(db);

      res.json({
        success: true,
        message: 'Banco de dados do servidor zerado com sucesso.',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Download do arquivo de backup do servidor
  app.get('/api/backup', (_req: Request, res: Response) => {
    try {
      const db = getDatabase();
      res.setHeader('Content-Disposition', `attachment; filename="backup_lojasj_${Date.now()}.json"`);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(db, null, 2));
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Restauração de backup completo no servidor
  app.post('/api/backup', (req: Request, res: Response) => {
    try {
      const { customers, coupons, settings, nextNumber } = req.body;
      if (!Array.isArray(customers) || !Array.isArray(coupons)) {
        return res.status(400).json({ success: false, error: 'Formato de backup inválido.' });
      }

      const db: ServerDatabase = {
        customers,
        coupons,
        settings: settings || null,
        nextNumber: typeof nextNumber === 'number' ? nextNumber : coupons.length + 1,
        lastUpdated: new Date().toISOString(),
      };

      saveDatabase(db);
      res.json({
        success: true,
        message: 'Backup restaurado com sucesso no servidor!',
        totalCustomers: db.customers.length,
        totalCoupons: db.coupons.length,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // CONFIGURAÇÃO DO VITE (DEV vs PROD)
  // ==========================================
  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' && hasDist) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR !== 'true',
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('Vite middleware could not be loaded:', viteErr);
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (_req: Request, res: Response) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Servidor SJ Cupons] Rodando na porta ${PORT} com persistência em ${DB_FILE}`);
  });
}

startServer();
