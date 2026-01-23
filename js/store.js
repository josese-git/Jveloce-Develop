/**
 * Store.js - Manages Data Persistence for Autos JVeloce
 * Uses LocalStorage to simulate a database.
 */

const DEFAULT_CARS = [
    {
        id: 'mercedes-class-a-2019',
        brand: 'Mercedes',
        model: 'Clase A 200d',
        year: '2019',
        fuel: 'Diesel',
        transmission: 'Auto',
        image: 'assets/mercedes_a_class.png',
        logo: 'assets/logo_mercedes.png',
        sold: false,
        price: '28.500€'
    },
    {
        id: 'peugeot-3008-2016',
        brand: 'Peugeot',
        model: '3008',
        year: '2016',
        fuel: 'Diesel',
        transmission: 'Manual',
        image: 'assets/peugeot_3008.png',
        logo: 'assets/logo_peugeot.png',
        sold: false,
        price: '18.900€'
    },
    {
        id: 'kia-sportage-2020',
        brand: 'Kia',
        model: 'Sportage',
        year: '2020',
        fuel: 'Híbrido',
        transmission: 'Auto',
        image: 'assets/kia_sportage.png',
        logo: 'assets/logo_kia_white.png',
        logoClass: 'wide', // Special handling for wide logos
        sold: false,
        price: '24.200€'
    }
];

class Store {
    constructor() {
        this.dbName = 'jveloce_db_v1';
        this.init();
    }

    init() {
        if (!localStorage.getItem(this.dbName)) {
            localStorage.setItem(this.dbName, JSON.stringify(DEFAULT_CARS));
            console.log('Database initialized with default data.');
        }
    }

    getAllCars() {
        return JSON.parse(localStorage.getItem(this.dbName)) || [];
    }

    addCar(car) {
        const cars = this.getAllCars();
        // Simple ID generation
        car.id = `${car.brand}-${car.model}-${Date.now()}`.toLowerCase().replace(/\s+/g, '-');
        cars.push(car);
        this.save(cars);
        return car;
    }

    deleteCar(id) {
        let cars = this.getAllCars();
        cars = cars.filter(c => c.id !== id);
        this.save(cars);
    }

    updateCar(id, updatedData) {
        let cars = this.getAllCars();
        const index = cars.findIndex(c => c.id === id);
        if (index !== -1) {
            cars[index] = { ...cars[index], ...updatedData };
            this.save(cars);
        }
    }

    save(cars) {
        localStorage.setItem(this.dbName, JSON.stringify(cars));
    }

    setCars(cars) {
        this.save(cars);
    }
}

// Export singleton
const store = new Store();
// Expose to window for now since we aren't using modules in HTML yet
window.store = store;
