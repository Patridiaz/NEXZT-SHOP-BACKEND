// En: src/auth/user-request.interface.ts (o similar)
export interface UserRequestData {
  id: number; // Coincide con lo que devuelve validate
  email: string;
  role: string; // O roles: string[] si es un array
}