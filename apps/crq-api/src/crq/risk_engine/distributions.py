"""Probability distributions for FAIR Risk Engine."""

import numpy as np

def sample_pert(min_val: float, mode_val: float, max_val: float, size: int) -> np.ndarray:
    """
    Sample from a modified PERT distribution.
    
    The PERT distribution is heavily used in FAIR to model expert estimates
    (min, mode, max). It is a transformation of the Beta distribution.
    
    Mean = (min + 4*mode + max) / 6
    Alpha = 1 + 4 * (mode - min) / (max - min)
    Beta = 1 + 4 * (max - mode) / (max - min)
    """
    if min_val == max_val:
        return np.full(size, min_val)
        
    # Scale mode to [0, 1]
    scaled_mode = (mode_val - min_val) / (max_val - min_val)
    
    alpha = 1 + 4 * scaled_mode
    beta = 1 + 4 * (1 - scaled_mode)
    
    # Sample from standard beta
    samples = np.random.beta(alpha, beta, size=size)
    
    # Scale back to [min, max]
    return min_val + samples * (max_val - min_val)

def sample_lognormal(mean: float, std_dev: float, size: int) -> np.ndarray:
    """Sample from a Lognormal distribution."""
    # Convert mean/std to lognormal parameters mu/sigma
    var = std_dev ** 2
    mu = np.log(mean ** 2 / np.sqrt(var + mean ** 2))
    sigma = np.sqrt(np.log(var / mean ** 2 + 1))
    
    return np.random.lognormal(mu, sigma, size=size)
