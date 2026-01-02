import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Region } from './region.entity';
import { Commune } from './commune.entity';

@Injectable()
export class LocationsService implements OnModuleInit {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    @InjectRepository(Region) private regionRepo: Repository<Region>,
    @InjectRepository(Commune) private communeRepo: Repository<Commune>,
  ) {}

  async onModuleInit() {
    await this.seedRegionsAndCommunes();
  }

  async findAll() {
    return this.regionRepo.find({
      relations: ['communes'],
      order: { id: 'ASC' }, 
    });
  }

  private async seedRegionsAndCommunes() {
    const count = await this.regionRepo.count();
    if (count > 0) {
      this.logger.log('Regiones y comunas ya existen. Saltando seed.');
      return;
    }

    this.logger.log('Iniciando carga de Regiones y Comunas con reglas de negocio...');

    const chileData = [
      {
        region: "Arica y Parinacota", romanNumber: "XV",
        communes: ["Arica", "Camarones", "Putre", "General Lagos"]
      },
      {
        region: "Tarapacá", romanNumber: "I",
        communes: ["Iquique", "Alto Hospicio", "Pozo Almonte", "Camiña", "Colchane", "Huara", "Pica"]
      },
      {
        region: "Antofagasta", romanNumber: "II",
        communes: ["Antofagasta", "Mejillones", "Sierra Gorda", "Taltal", "Calama", "Ollagüe", "San Pedro de Atacama", "Tocopilla", "María Elena"]
      },
      {
        region: "Atacama", romanNumber: "III",
        communes: ["Copiapó", "Caldera", "Tierra Amarilla", "Chañaral", "Diego de Almagro", "Vallenar", "Alto del Carmen", "Freirina", "Huasco"]
      },
      {
        region: "Coquimbo", romanNumber: "IV",
        communes: ["La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paiguano", "Vicuña", "Illapel", "Canela", "Los Vilos", "Salamanca", "Ovalle", "Combarbalá", "Monte Patria", "Punitaqui", "Río Hurtado"]
      },
      {
        region: "Valparaíso", romanNumber: "V",
        communes: [
          "Valparaíso", "Casablanca", "Concón", "Juan Fernández", "Puchuncaví", "Quintero", "Viña del Mar", 
          "Isla de Pascua", "Los Andes", "Calle Larga", "Rinconada", "San Esteban", "La Ligua", "Cabildo", 
          "Papudo", "Petorca", "Zapallar", "Quillota", "Calera", "Hijuelas", "La Cruz", "Nogales", 
          "San Antonio", "Algarrobo", "Cartagena", "El Quisco", "El Tabo", "Santo Domingo", "San Felipe", 
          "Catemu", "Llaillay", "Panquehue", "Putaendo", "Santa María", "Quilpué", "Limache", "Olmué", 
          "Villa Alemana"
        ]
      },
      // ✅ REGIÓN METROPOLITANA (Aquí aplicaremos la lógica de precios)
      {
        region: "Metropolitana de Santiago", romanNumber: "RM",
        communes: [
          "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba", "Independencia", 
          "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes", "Lo Barnechea", 
          "Lo Espejo", "Lo Prado", "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", 
          "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", 
          "Santiago", "Vitacura", "Puente Alto", "Pirque", "San José de Maipo", "Colina", "Lampa", "Tiltil", 
          "San Bernardo", "Buin", "Calera de Tango", "Paine", "Melipilla", "Alhué", "Curacaví", "María Pinto", 
          "San Pedro", "Talagante", "El Monte", "Isla de Maipo", "Padre Hurtado", "Peñaflor"
        ]
      },
      {
        region: "Libertador Gral. Bernardo O'Higgins", romanNumber: "VI",
        communes: [
          "Rancagua", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "Las Cabras", "Machalí", "Malloa", 
          "Mostazal", "Olivar", "Peumo", "Pichidegua", "Quinta de Tilcoco", "Rengo", "Requínoa", "San Vicente", 
          "Pichilemu", "La Estrella", "Litueche", "Marchihue", "Navidad", "Paredones", "San Fernando", "Chépica", 
          "Chimbarongo", "Lolol", "Nancagua", "Palmilla", "Peralillo", "Placilla", "Pumanque", "Santa Cruz"
        ]
      },
      {
        region: "Maule", romanNumber: "VII",
        communes: [
          "Talca", "Constitución", "Curepto", "Empedrado", "Maule", "Pelarco", "Pencahue", "Río Claro", 
          "San Clemente", "San Rafael", "Cauquenes", "Chanco", "Pelluhue", "Curicó", "Hualañé", "Licantén", 
          "Molina", "Rauco", "Romeral", "Sagrada Familia", "Teno", "Vichuquén", "Linares", "Colbún", "Longaví", 
          "Parral", "Retiro", "San Javier", "Villa Alegre", "Yerbas Buenas"
        ]
      },
      {
        region: "Ñuble", romanNumber: "XVI",
        communes: [
          "Cobquecura", "Coelemu", "Ninhue", "Portezuelo", "Quirihue", "Ránquil", "Treguaco", "Bulnes", 
          "Chillán Viejo", "Chillán", "El Carmen", "Pemuco", "Pinto", "Quillón", "San Ignacio", "Yungay", 
          "Coihueco", "Ñiquén", "San Carlos", "San Fabián", "San Nicolás"
        ]
      },
      {
        region: "Biobío", romanNumber: "VIII",
        communes: [
          "Concepción", "Coronel", "Chiguayante", "Florida", "Hualqui", "Lota", "Penco", "San Pedro de la Paz", 
          "Santa Juana", "Talcahuano", "Tomé", "Hualpén", "Lebu", "Arauco", "Cañete", "Contulmo", "Curanilahue", 
          "Los Álamos", "Tirúa", "Los Ángeles", "Antuco", "Cabrero", "Laja", "Mulchén", "Nacimiento", "Negrete", 
          "Quilaco", "Quilleco", "San Rosendo", "Santa Bárbara", "Tucapel", "Yumbel", "Alto Biobío"
        ]
      },
      {
        region: "Araucanía", romanNumber: "IX",
        communes: [
          "Temuco", "Carahue", "Cunco", "Curarrehue", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche", 
          "Melipeuco", "Nueva Imperial", "Padre las Casas", "Perquenco", "Pitrufquén", "Pucón", "Saavedra", 
          "Teodoro Schmidt", "Toltén", "Vilcún", "Villarrica", "Cholchol", "Angol", "Collipulli", "Curacautín", 
          "Ercilla", "Lonquimay", "Los Sauces", "Lumaco", "Purén", "Renaico", "Traiguén", "Victoria"
        ]
      },
      {
        region: "Los Ríos", romanNumber: "XIV",
        communes: [
          "Valdivia", "Corral", "Lanco", "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli", 
          "La Unión", "Futrono", "Lago Ranco", "Río Bueno"
        ]
      },
      {
        region: "Los Lagos", romanNumber: "X",
        communes: [
          "Puerto Montt", "Calbuco", "Cochamó", "Fresia", "Frutillar", "Los Muermos", "Llanquihue", "Maullín", 
          "Puerto Varas", "Castro", "Ancud", "Chonchi", "Curaco de Vélez", "Dalcahue", "Puqueldón", "Queilén", 
          "Quellón", "Quemchi", "Quinchao", "Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", 
          "San Juan de la Costa", "San Pablo", "Chaitén", "Futaleufú", "Hualaihué", "Palena"
        ]
      },
      {
        region: "Aisén del Gral. Carlos Ibáñez del Campo", romanNumber: "XI",
        communes: [
          "Coihaique", "Lago Verde", "Aisén", "Cisnes", "Guaitecas", "Cochrane", "O'Higgins", "Tortel", 
          "Chile Chico", "Río Ibáñez"
        ]
      },
      {
        region: "Magallanes y de la Antártica Chilena", romanNumber: "XII",
        communes: [
          "Punta Arenas", "Laguna Blanca", "Río Verde", "San Gregorio", "Cabo de Hornos (Ex Navarino)", 
          "Antártica", "Porvenir", "Primavera", "Timaukel", "Natales", "Torres del Paine"
        ]
      }
    ];

    // INICIO DEL SEEDING
    for (const regionData of chileData) {
      const region = this.regionRepo.create({
        name: regionData.region,
        romanNumber: regionData.romanNumber,
      });
      await this.regionRepo.save(region);

      const isRM = regionData.region === "Metropolitana de Santiago";

      for (const communeName of regionData.communes) {
        let shippingCost: number | null = null;
        let isDispatchAvailable = true;

        if (isRM) {
          // --- LÓGICA DE PRECIOS PARA SANTIAGO ---
          
          // 1. Excluidas (No se despacha)
          const excludedCommunes = ['Padre Hurtado', 'Pudahuel', 'Quilicura'];
          if (excludedCommunes.includes(communeName)) {
            isDispatchAvailable = false;
            shippingCost = null;
          } 
          // 2. Tarifa Alta: $6.000
          else if (['Lo Barnechea', 'San José de Maipo'].includes(communeName)) {
            shippingCost = 6000;
          }
          // 3. Tarifa Media: $5.000
          else if (['Puente Alto', 'La Reina', 'Las Condes', 'Vitacura', 'Renca', 'Maipú', 'San Bernardo'].includes(communeName)) {
            shippingCost = 5000;
          }
          // 4. Tarifa Base (Resto de comunas en RM): $4.000
          else {
            shippingCost = 4000;
          }
        } 
        // Si no es RM, el costo queda en NULL (Starken por pagar) y isDispatchAvailable en true.

        const commune = this.communeRepo.create({
          name: communeName,
          region: region,
          fixedShippingCost: shippingCost,
          isDispatchAvailable: isDispatchAvailable
        });
        await this.communeRepo.save(commune);
      }
    }
    
    this.logger.log('¡Carga de regiones y comunas finalizada con éxito!');
  }
}