import { Database } from '@tableland/sdk';
import { Signer } from '@tableland/sdk';
import type { Meal, FoodItem, User } from '@cloe/types';
import { BASE_SEPOLIA_CHAIN_ID, TABLE_PREFIX } from './config';

export class TablelandService {
  private db: Database | null = null;
  private userTableName: string | null = null;
  private profileTableName: string | null = null;
  private signer: Signer | null = null;

  async initialize(signer: Signer) {
    this.signer = signer;
    this.db = new Database({ signer });
  }

  async createUserTable(userAddress: string): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const prefix = `${TABLE_PREFIX}_${userAddress.slice(2, 8).toLowerCase()}`;
    
    const { meta: create } = await this.db
      .prepare(`CREATE TABLE ${prefix} (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        meal_type TEXT NOT NULL,
        total_calories INTEGER NOT NULL,
        total_carbs REAL NOT NULL,
        total_fats REAL NOT NULL,
        total_proteins REAL NOT NULL,
        items TEXT NOT NULL,
        image_url TEXT
      );`)
      .run();

    await create.txn?.wait();
    const tableName = create.txn?.names[0] ?? '';
    this.userTableName = tableName;
    
    return tableName;
  }

  async createProfileTable(userAddress: string): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const prefix = `${TABLE_PREFIX}_profile_${userAddress.slice(2, 8).toLowerCase()}`;
    
    const { meta: create } = await this.db
      .prepare(`CREATE TABLE ${prefix} (
        address TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        daily_calorie_target INTEGER NOT NULL DEFAULT 2000,
        daily_carbs_target REAL NOT NULL DEFAULT 250,
        daily_fats_target REAL NOT NULL DEFAULT 65,
        daily_proteins_target REAL NOT NULL DEFAULT 150,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`)
      .run();

    await create.txn?.wait();
    const tableName = create.txn?.names[0] ?? '';
    this.profileTableName = tableName;
    
    return tableName;
  }

  async getUserTable(userAddress: string): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Query the registry to find user's table
    const tables = await this.db.prepare(
      `SELECT name FROM registry WHERE controller = ?`
    ).bind(userAddress).all();
    
    if (tables.results.length > 0) {
      // Find the table that matches our prefix pattern
      const userTable = tables.results.find(table => 
        table.name.startsWith(`${TABLE_PREFIX}_${userAddress.slice(2, 8).toLowerCase()}`)
      );
      
      if (userTable) {
        this.userTableName = userTable.name;
        return userTable.name;
      }
    }
    
    return null;
  }

  async saveMeal(meal: Meal): Promise<void> {
    if (!this.db || !this.userTableName) {
      throw new Error('Database or table not initialized');
    }

    const itemsJson = JSON.stringify(meal.items);
    
    const { meta } = await this.db
      .prepare(`INSERT INTO ${this.userTableName} (
        id, timestamp, meal_type, total_calories, 
        total_carbs, total_fats, total_proteins, items, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        meal.id,
        Math.floor(meal.timestamp.getTime() / 1000),
        meal.type,
        meal.totalNutrition.calories,
        meal.totalNutrition.carbs,
        meal.totalNutrition.fats,
        meal.totalNutrition.proteins,
        itemsJson,
        meal.imageUrl || ''
      )
      .run();

    await meta.txn?.wait();
  }

  async getMeals(startDate?: Date, endDate?: Date): Promise<Meal[]> {
    if (!this.db || !this.userTableName) {
      throw new Error('Database or table not initialized');
    }

    let query = `SELECT * FROM ${this.userTableName}`;
    const bindings: any[] = [];

    if (startDate && endDate) {
      query += ' WHERE timestamp >= ? AND timestamp <= ?';
      bindings.push(
        Math.floor(startDate.getTime() / 1000),
        Math.floor(endDate.getTime() / 1000)
      );
    }

    query += ' ORDER BY timestamp DESC';

    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .all();

    return result.results.map((row: any) => ({
      id: row.id,
      userId: '', // We don't store userId in the table since it's user-specific
      timestamp: new Date(row.timestamp * 1000),
      type: row.meal_type,
      items: JSON.parse(row.items),
      totalNutrition: {
        calories: row.total_calories,
        carbs: row.total_carbs,
        fats: row.total_fats,
        proteins: row.total_proteins,
      },
      imageUrl: row.image_url || undefined,
    }));
  }

  async getTodayMeals(): Promise<Meal[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.getMeals(today, tomorrow);
  }

  async getProfileTable(userAddress: string): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const tables = await this.db.prepare(
      `SELECT name FROM registry WHERE controller = ?`
    ).bind(userAddress).all();
    
    if (tables.results.length > 0) {
      const profileTable = tables.results.find(table => 
        table.name.startsWith(`${TABLE_PREFIX}_profile_${userAddress.slice(2, 8).toLowerCase()}`)
      );
      
      if (profileTable) {
        this.profileTableName = profileTable.name;
        return profileTable.name;
      }
    }
    
    return null;
  }

  async saveUserProfile(user: User): Promise<void> {
    if (!this.db || !this.profileTableName) {
      throw new Error('Database or profile table not initialized');
    }

    const now = Math.floor(Date.now() / 1000);
    
    const { meta } = await this.db
      .prepare(`INSERT OR REPLACE INTO ${this.profileTableName} (
        address, name, email, daily_calorie_target,
        daily_carbs_target, daily_fats_target, daily_proteins_target,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        user.id, // Using ID as address
        user.name,
        user.email,
        user.dailyCalorieTarget,
        user.dailyMacroTargets.carbs,
        user.dailyMacroTargets.fats,
        user.dailyMacroTargets.proteins,
        now,
        now
      )
      .run();

    await meta.txn?.wait();
  }

  async getUserProfile(userAddress: string): Promise<User | null> {
    if (!this.db || !this.profileTableName) {
      return null;
    }

    const result = await this.db
      .prepare(`SELECT * FROM ${this.profileTableName} WHERE address = ?`)
      .bind(userAddress)
      .first();

    if (!result) return null;

    return {
      id: result.address,
      name: result.name,
      email: result.email,
      dailyCalorieTarget: result.daily_calorie_target,
      dailyMacroTargets: {
        carbs: result.daily_carbs_target,
        fats: result.daily_fats_target,
        proteins: result.daily_proteins_target,
      },
    };
  }

  async initializeUserTables(userAddress: string): Promise<{
    mealsTable: string;
    profileTable: string;
  }> {
    // Check for existing tables
    let mealsTable = await this.getUserTable(userAddress);
    let profileTable = await this.getProfileTable(userAddress);
    
    // Create tables if they don't exist
    if (!mealsTable) {
      mealsTable = await this.createUserTable(userAddress);
    }
    
    if (!profileTable) {
      profileTable = await this.createProfileTable(userAddress);
    }
    
    return { mealsTable, profileTable };
  }
}