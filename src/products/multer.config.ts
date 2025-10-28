import { diskStorage } from 'multer';
import { extname } from 'path';

export const multerOptions = {
  storage: diskStorage({
    // 1. Dónde guardar los archivos
    destination: './uploads', 
    
    // 2. Cómo nombrar el archivo
    filename: (req, file, callback) => {
      const name = file.originalname.split('.')[0];
      const fileExtName = extname(file.originalname);
      const randomName = Array(16)
        .fill(null)
        .map(() => Math.round(Math.random() * 16).toString(16))
        .join('');
      // Genera un nombre como: "mi-imagen-a1b2c3d4e5f6.png"
      callback(null, `${name}-${randomName}${fileExtName}`);
    },
  }),
  // Opcional: Filtro para aceptar solo imágenes
  fileFilter: (req, file, callback) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return callback(new Error('¡Solo se permiten archivos de imagen!'), false);
    }
    callback(null, true);
  },
};