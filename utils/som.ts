import { euclideanDistance } from './mathUtils';

export class SOM {
  width: number;
  height: number;
  inputDim: number;
  weights: number[][][]; // [x][y][dim]

  constructor(width: number, height: number, inputDim: number) {
    this.width = width;
    this.height = height;
    this.inputDim = inputDim;
    this.weights = [];

    // Initialize weights randomly
    for (let x = 0; x < width; x++) {
      this.weights[x] = [];
      for (let y = 0; y < height; y++) {
        this.weights[x][y] = Array(inputDim).fill(0).map(() => Math.random() - 0.5);
      }
    }
  }

  /**
   * Trains the SOM with the given input vectors.
   * @param data Array of input vectors
   * @param iterations Number of iterations
   * @param startLearningRate Initial learning rate
   */
  train(data: number[][], iterations: number = 1000, startLearningRate: number = 0.5) {
    if (data.length === 0) return;

    let learningRate = startLearningRate;
    // Initial radius is half the map size
    let radius = Math.max(this.width, this.height) / 2;
    const timeConstant = iterations / Math.log(radius);

    for (let i = 0; i < iterations; i++) {
      // Pick random input vector
      const input = data[Math.floor(Math.random() * data.length)];
      
      // Find Best Matching Unit (BMU)
      const bmu = this.findBMU(input);
      
      // Update weights of BMU and neighbors
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          const distToBMU = Math.sqrt((x - bmu.x) ** 2 + (y - bmu.y) ** 2);
          
          if (distToBMU < radius) {
            // Gaussian influence
            const theta = Math.exp(-(distToBMU ** 2) / (2 * radius ** 2));
            const influence = theta * learningRate;

            // Update weight vector
            for (let d = 0; d < this.inputDim; d++) {
              this.weights[x][y][d] += influence * (input[d] - this.weights[x][y][d]);
            }
          }
        }
      }

      // Decay learning parameters
      radius = radius * Math.exp(-1 / timeConstant); // Not exactly strict formula but works for visual
      // Linear decay for learning rate often more stable for small maps
      learningRate = startLearningRate * (1 - i / iterations);
    }
  }

  findBMU(input: number[]): { x: number, y: number } {
    let minDist = Infinity;
    let bmu = { x: 0, y: 0 };

    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const dist = euclideanDistance(input, this.weights[x][y]);
        if (dist < minDist) {
          minDist = dist;
          bmu = { x, y };
        }
      }
    }
    return bmu;
  }

  /**
   * Calculates the U-Matrix (Unified Distance Matrix).
   * High values mean boundaries/walls (dissimilar neighbors).
   * Low values mean clusters (similar neighbors).
   */
  getUMatrix(): number[][] {
    const uMatrix = Array(this.width).fill(0).map(() => Array(this.height).fill(0));

    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        let sumDist = 0;
        let count = 0;

        // Check neighbors
        const neighbors = [
          { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
          { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
        ];

        for (const n of neighbors) {
          const nx = x + n.dx;
          const ny = y + n.dy;
          if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            sumDist += euclideanDistance(this.weights[x][y], this.weights[nx][ny]);
            count++;
          }
        }
        uMatrix[x][y] = count > 0 ? sumDist / count : 0;
      }
    }

    // Normalize 0-1
    let max = 0;
    let min = Infinity;
    for(let x=0; x<this.width; x++) {
        for(let y=0; y<this.height; y++) {
            if(uMatrix[x][y] > max) max = uMatrix[x][y];
            if(uMatrix[x][y] < min) min = uMatrix[x][y];
        }
    }
    
    for(let x=0; x<this.width; x++) {
        for(let y=0; y<this.height; y++) {
            uMatrix[x][y] = (uMatrix[x][y] - min) / (max - min || 1);
        }
    }

    return uMatrix;
  }
}