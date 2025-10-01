// En src/data-source.ts

import 'dotenv/config'; // Importante para cargar las variables de entorno
import { DataSource, DataSourceOptions } from 'typeorm';

export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: ['dist/**/*.entity.js'],   // Apunta a las entidades compiladas
  migrations: ['dist/db/migrations/*.js'], // Apunta a las migraciones compiladas
  synchronize: false, // Las migraciones no deben usar synchronize
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;