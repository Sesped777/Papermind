
/**
 * Computes the Cosine Similarity between two vectors.
 * This acts as our linear kernel function K(x, y) = <x, y> / (||x|| * ||y||)
 * used to measure semantic similarity in the embedding space.
 */
export const cosineSimilarityKernel = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same dimensionality");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Normalizes a vector to unit length.
 * Useful if we want to optimize subsequent dot products.
 */
export const normalizeVector = (vec: number[]): number[] => {
  let norm = 0;
  for (const val of vec) {
    norm += val * val;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((val) => val / norm);
};

/**
 * Computes Euclidean Distance between two vectors.
 * Used for Self-Organizing Maps (SOM).
 */
export const euclideanDistance = (vecA: number[], vecB: number[]): number => {
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

/**
 * Computes the full N x N Kernel Matrix (Similarity Matrix).
 */
export const computeKernelMatrix = (vectors: number[][]): number[][] => {
  const n = vectors.length;
  const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else {
        const sim = cosineSimilarityKernel(vectors[i], vectors[j]);
        matrix[i][j] = sim;
        matrix[j][i] = sim;
      }
    }
  }
  return matrix;
};

/**
 * Calculates simple statistics for an array of numbers.
 */
export const calculateStats = (values: number[]) => {
  if (values.length === 0) return { mean: 0, variance: 0, min: 0, max: 0 };
  
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  
  return {
    mean,
    variance,
    min: Math.min(...values),
    max: Math.max(...values)
  };
};

// --- CLUSTERING HELPERS ---

const addVectors = (a: number[], b: number[]): number[] => {
    return a.map((val, i) => val + b[i]);
};

const divideVector = (a: number[], scalar: number): number[] => {
    return a.map(val => val / scalar);
};

/**
 * Performs K-Means clustering.
 */
export const kMeans = (vectors: number[][], k: number, maxIterations: number = 20): number[] => {
    if (vectors.length === 0) return [];
    if (k >= vectors.length) return vectors.map((_, i) => i); 

    const dimension = vectors[0].length;
    
    // 1. Initialize Centroids (Randomly pick k vectors)
    let centroids = [];
    const usedIndices = new Set<number>();
    while (centroids.length < k) {
        const idx = Math.floor(Math.random() * vectors.length);
        if (!usedIndices.has(idx)) {
            centroids.push([...vectors[idx]]);
            usedIndices.add(idx);
        }
    }

    let assignments = new Array(vectors.length).fill(-1);
    let iterations = 0;
    let changed = true;

    while (changed && iterations < maxIterations) {
        changed = false;
        const newClusterSums = Array(k).fill(0).map(() => Array(dimension).fill(0));
        const newClusterCounts = Array(k).fill(0);

        for (let i = 0; i < vectors.length; i++) {
            let minDist = Infinity;
            let closestCluster = 0;

            for (let c = 0; c < k; c++) {
                const dist = euclideanDistance(vectors[i], centroids[c]);
                if (dist < minDist) {
                    minDist = dist;
                    closestCluster = c;
                }
            }

            if (assignments[i] !== closestCluster) {
                assignments[i] = closestCluster;
                changed = true;
            }

            newClusterSums[closestCluster] = addVectors(newClusterSums[closestCluster], vectors[i]);
            newClusterCounts[closestCluster]++;
        }

        for (let c = 0; c < k; c++) {
            if (newClusterCounts[c] > 0) {
                centroids[c] = divideVector(newClusterSums[c], newClusterCounts[c]);
            } else {
                const randomIdx = Math.floor(Math.random() * vectors.length);
                centroids[c] = [...vectors[randomIdx]];
            }
        }
        iterations++;
    }
    return assignments;
};

/**
 * DBSCAN (Density-Based Spatial Clustering of Applications with Noise).
 * Returns assignments array where -1 indicates noise.
 * 
 * @param vectors Input data
 * @param epsilon Maximum radius of the neighborhood
 * @param minPts Minimum number of points required to form a dense region
 */
export const dbscan = (vectors: number[][], epsilon: number, minPts: number): number[] => {
  const n = vectors.length;
  const labels = new Array(n).fill(0); // 0 = undefined, -1 = noise, >0 = cluster ID
  let clusterId = 0;

  const getNeighbors = (idx: number): number[] => {
    const neighbors: number[] = [];
    for (let i = 0; i < n; i++) {
      if (i !== idx) {
        // Using Euclidean distance for DBSCAN standard
        if (euclideanDistance(vectors[idx], vectors[i]) <= epsilon) {
          neighbors.push(i);
        }
      }
    }
    return neighbors;
  };

  for (let i = 0; i < n; i++) {
    if (labels[i] !== 0) continue;

    const neighbors = getNeighbors(i);
    
    // Check if point is core point (neighbors count includes itself usually, but here we pushed others)
    // Adjusting minPts logic: if neighbors.length + 1 < minPts -> Noise
    if (neighbors.length + 1 < minPts) {
      labels[i] = -1; // Noise
      continue;
    }

    clusterId++;
    labels[i] = clusterId;

    const seedSet = [...neighbors];
    for (let j = 0; j < seedSet.length; j++) {
      const neighborIdx = seedSet[j];
      
      if (labels[neighborIdx] === -1) {
         labels[neighborIdx] = clusterId; // Change noise to border point
      }
      if (labels[neighborIdx] !== 0) {
         continue; // Already processed
      }

      labels[neighborIdx] = clusterId;
      
      const neighborNeighbors = getNeighbors(neighborIdx);
      if (neighborNeighbors.length + 1 >= minPts) {
        // Add new neighbors to seed set
        // Avoid duplicates in a simple way or let loop handle it (inefficient but safe)
        for(const nn of neighborNeighbors) {
            if(!seedSet.includes(nn)) seedSet.push(nn);
        }
      }
    }
  }

  // Normalize labels to 0-based index for compatibility with K-Means visualizer
  // -1 remains -1 (Noise)
  return labels.map(l => l === -1 ? -1 : l - 1);
};


// --- CLUSTERING METRICS ---

export interface ClusteringMetrics {
    silhouetteScore: number;
    daviesBouldinIndex: number;
    calinskiHarabaszIndex: number;
}

const getClusterCentroids = (vectors: number[][], labels: number[], uniqueClusters: number[]) => {
    const centroids = new Map<number, number[]>();
    uniqueClusters.forEach(k => {
        const clusterVectors = vectors.filter((_, i) => labels[i] === k);
        if (clusterVectors.length === 0) return;
        
        const sum = clusterVectors.reduce((acc, curr) => addVectors(acc, curr), new Array(vectors[0].length).fill(0));
        centroids.set(k, divideVector(sum, clusterVectors.length));
    });
    return centroids;
};

/**
 * Calculates Silhouette Score.
 * Range: [-1, 1]. High value = good clustering.
 * Formula: (b - a) / max(a, b)
 */
const calculateSilhouetteScore = (vectors: number[][], labels: number[]): number => {
    if (vectors.length < 2) return 0;
    
    let totalScore = 0;
    let validPoints = 0;

    for (let i = 0; i < vectors.length; i++) {
        const currentCluster = labels[i];
        // Skip noise in DBSCAN
        if (currentCluster === -1) continue;

        // a(i): Mean distance to other points in same cluster
        let a = 0;
        let sameClusterCount = 0;
        
        // b(i): Mean distance to points in the nearest OTHER cluster
        let minMeanDistOther = Infinity;
        const otherClusterDists = new Map<number, {sum: number, count: number}>();

        for (let j = 0; j < vectors.length; j++) {
            if (i === j) continue;
            const dist = euclideanDistance(vectors[i], vectors[j]);
            const otherLabel = labels[j];

            if (otherLabel === -1) continue; // Ignore noise neighbors

            if (otherLabel === currentCluster) {
                a += dist;
                sameClusterCount++;
            } else {
                if (!otherClusterDists.has(otherLabel)) otherClusterDists.set(otherLabel, {sum: 0, count: 0});
                const entry = otherClusterDists.get(otherLabel)!;
                entry.sum += dist;
                entry.count++;
            }
        }

        if (sameClusterCount === 0) {
            // Cluster of size 1, silhouette is 0 by definition
            continue;
        }
        a = a / sameClusterCount;

        // Find b(i)
        for (const [_, data] of otherClusterDists) {
            const meanDist = data.sum / data.count;
            if (meanDist < minMeanDistOther) minMeanDistOther = meanDist;
        }
        
        // If only 1 cluster exists globally, b is undefined (conceptually 0 or ignore)
        if (minMeanDistOther === Infinity) minMeanDistOther = 0;

        const b = minMeanDistOther;
        
        // Avoid div by zero
        const maxAB = Math.max(a, b);
        const s = maxAB === 0 ? 0 : (b - a) / maxAB;
        
        totalScore += s;
        validPoints++;
    }

    return validPoints > 0 ? totalScore / validPoints : 0;
};

/**
 * Calculates Davies-Bouldin Index.
 * Range: [0, Infinity). Low value = good clustering.
 */
const calculateDaviesBouldinIndex = (vectors: number[][], labels: number[], uniqueClusters: number[], centroids: Map<number, number[]>): number => {
    if (uniqueClusters.length < 2) return 0;

    // 1. Calculate average distance from points to their centroid (Scatter)
    const scatters = new Map<number, number>();
    uniqueClusters.forEach(k => {
        const centroid = centroids.get(k)!;
        const clusterIndices = vectors.map((_, i) => i).filter(i => labels[i] === k);
        let sumDist = 0;
        clusterIndices.forEach(idx => {
            sumDist += euclideanDistance(vectors[idx], centroid);
        });
        scatters.set(k, sumDist / clusterIndices.length);
    });

    // 2. Compute DB Index
    let sumMaxR = 0;
    uniqueClusters.forEach(i => {
        let maxR = -Infinity;
        uniqueClusters.forEach(j => {
            if (i === j) return;
            
            const scatterI = scatters.get(i)!;
            const scatterJ = scatters.get(j)!;
            const distCentroids = euclideanDistance(centroids.get(i)!, centroids.get(j)!);
            
            if (distCentroids === 0) return; // Avoid div 0
            
            const R_ij = (scatterI + scatterJ) / distCentroids;
            if (R_ij > maxR) maxR = R_ij;
        });
        if (maxR !== -Infinity) sumMaxR += maxR;
    });

    return sumMaxR / uniqueClusters.length;
};

/**
 * Calculates Calinski-Harabasz Index.
 * Range: [0, Infinity). High value = good clustering.
 */
const calculateCalinskiHarabaszIndex = (vectors: number[][], labels: number[], uniqueClusters: number[], centroids: Map<number, number[]>): number => {
    const N = vectors.filter((_, i) => labels[i] !== -1).length;
    const K = uniqueClusters.length;
    if (K < 2 || N <= K) return 0;

    // Global Centroid
    let globalCentroid = new Array(vectors[0].length).fill(0);
    vectors.forEach(v => { globalCentroid = addVectors(globalCentroid, v); });
    globalCentroid = divideVector(globalCentroid, vectors.length);

    // SS_B (Between Group Sum of Squares)
    let SS_B = 0;
    uniqueClusters.forEach(k => {
        const nk = vectors.filter((_, i) => labels[i] === k).length;
        const dist = euclideanDistance(centroids.get(k)!, globalCentroid);
        SS_B += nk * (dist * dist);
    });

    // SS_W (Within Group Sum of Squares)
    let SS_W = 0;
    uniqueClusters.forEach(k => {
        const centroid = centroids.get(k)!;
        const indices = vectors.map((_, i) => i).filter(i => labels[i] === k);
        indices.forEach(idx => {
            const dist = euclideanDistance(vectors[idx], centroid);
            SS_W += dist * dist;
        });
    });

    if (SS_W === 0) return 0;

    return (SS_B / (K - 1)) / (SS_W / (N - K));
};

export const calculateClusteringMetrics = (vectors: number[][], labels: number[]): ClusteringMetrics => {
    // Filter noise out for metric calculations typically, or handle them as separate checks.
    // For standard metrics, we usually consider only clustered points or treat noise as a cluster (which hurts scores).
    // Here we exclude noise (-1) from the logic to evaluate the QUALITY of the formed clusters.
    
    const uniqueClusters = Array.from(new Set(labels)).filter(l => l !== -1);
    const centroids = getClusterCentroids(vectors, labels, uniqueClusters);

    return {
        silhouetteScore: calculateSilhouetteScore(vectors, labels),
        daviesBouldinIndex: calculateDaviesBouldinIndex(vectors, labels, uniqueClusters, centroids),
        calinskiHarabaszIndex: calculateCalinskiHarabaszIndex(vectors, labels, uniqueClusters, centroids)
    };
};
