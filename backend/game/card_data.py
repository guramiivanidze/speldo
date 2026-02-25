"""
All 90 development cards and 10 noble tiles for Splendor.
Colors: white (diamond), blue (sapphire), green (emerald), red (ruby), black (onyx)
"""

# Level 1 cards (40 total)
# Format: (id, level, bonus_color, prestige_points, cost_white, cost_blue, cost_green, cost_red, cost_black)
LEVEL1_CARDS = [
    # Black bonus cards
    {"id": 1,  "level": 1, "bonus": "black", "points": 0, "cost": {"black": 1, "red": 1, "white": 1, "blue": 1, "green": 0}},
    {"id": 2,  "level": 1, "bonus": "black", "points": 0, "cost": {"black": 2, "red": 0, "white": 0, "blue": 0, "green": 2}},
    {"id": 3,  "level": 1, "bonus": "black", "points": 0, "cost": {"black": 0, "red": 0, "white": 2, "blue": 1, "green": 0}},
    {"id": 4,  "level": 1, "bonus": "black", "points": 0, "cost": {"black": 3, "red": 0, "white": 0, "blue": 0, "green": 0}},
    {"id": 5,  "level": 1, "bonus": "black", "points": 0, "cost": {"black": 0, "red": 2, "white": 0, "blue": 0, "green": 2}},
    {"id": 6,  "level": 1, "bonus": "black", "points": 0, "cost": {"black": 2, "red": 1, "white": 0, "blue": 0, "green": 0}},
    {"id": 7,  "level": 1, "bonus": "black", "points": 0, "cost": {"black": 0, "red": 0, "white": 0, "blue": 0, "green": 3}},
    {"id": 8,  "level": 1, "bonus": "black", "points": 1, "cost": {"black": 4, "red": 0, "white": 0, "blue": 0, "green": 0}},
    # Blue bonus cards
    {"id": 9,  "level": 1, "bonus": "blue",  "points": 0, "cost": {"black": 0, "red": 1, "white": 1, "blue": 1, "green": 1}},
    {"id": 10, "level": 1, "bonus": "blue",  "points": 0, "cost": {"black": 0, "red": 0, "white": 0, "blue": 0, "green": 3}},
    {"id": 11, "level": 1, "bonus": "blue",  "points": 0, "cost": {"black": 0, "red": 2, "white": 0, "blue": 1, "green": 0}},
    {"id": 12, "level": 1, "bonus": "blue",  "points": 0, "cost": {"black": 0, "red": 0, "white": 1, "blue": 2, "green": 0}},
    {"id": 13, "level": 1, "bonus": "blue",  "points": 0, "cost": {"black": 1, "red": 0, "white": 2, "blue": 0, "green": 0}},
    {"id": 14, "level": 1, "bonus": "blue",  "points": 0, "cost": {"black": 2, "red": 0, "white": 2, "blue": 0, "green": 0}},
    {"id": 15, "level": 1, "bonus": "blue",  "points": 0, "cost": {"black": 0, "red": 0, "white": 0, "blue": 3, "green": 0}},
    {"id": 16, "level": 1, "bonus": "blue",  "points": 1, "cost": {"black": 0, "red": 0, "white": 4, "blue": 0, "green": 0}},
    # White bonus cards
    {"id": 17, "level": 1, "bonus": "white", "points": 0, "cost": {"black": 1, "red": 1, "white": 0, "blue": 1, "green": 1}},
    {"id": 18, "level": 1, "bonus": "white", "points": 0, "cost": {"black": 3, "red": 0, "white": 0, "blue": 0, "green": 0}},
    {"id": 19, "level": 1, "bonus": "white", "points": 0, "cost": {"black": 2, "red": 0, "white": 0, "blue": 1, "green": 0}},
    {"id": 20, "level": 1, "bonus": "white", "points": 0, "cost": {"black": 0, "red": 1, "white": 0, "blue": 0, "green": 2}},
    {"id": 21, "level": 1, "bonus": "white", "points": 0, "cost": {"black": 0, "red": 0, "white": 0, "blue": 2, "green": 0}},
    {"id": 22, "level": 1, "bonus": "white", "points": 0, "cost": {"black": 0, "red": 2, "white": 0, "blue": 0, "green": 0}},
    {"id": 23, "level": 1, "bonus": "white", "points": 0, "cost": {"black": 0, "red": 0, "white": 0, "blue": 0, "green": 2}},
    {"id": 24, "level": 1, "bonus": "white", "points": 1, "cost": {"black": 0, "red": 4, "white": 0, "blue": 0, "green": 0}},
    # Green bonus cards
    {"id": 25, "level": 1, "bonus": "green", "points": 0, "cost": {"black": 1, "red": 0, "white": 1, "blue": 1, "green": 1}},
    {"id": 26, "level": 1, "bonus": "green", "points": 0, "cost": {"black": 0, "red": 2, "white": 0, "blue": 1, "green": 0}},
    {"id": 27, "level": 1, "bonus": "green", "points": 0, "cost": {"black": 0, "red": 0, "white": 0, "blue": 2, "green": 1}},
    {"id": 28, "level": 1, "bonus": "green", "points": 0, "cost": {"black": 1, "red": 0, "white": 0, "blue": 0, "green": 2}},
    {"id": 29, "level": 1, "bonus": "green", "points": 0, "cost": {"black": 0, "red": 3, "white": 0, "blue": 0, "green": 0}},
    {"id": 30, "level": 1, "bonus": "green", "points": 0, "cost": {"black": 0, "red": 0, "white": 2, "blue": 0, "green": 2}},
    {"id": 31, "level": 1, "bonus": "green", "points": 0, "cost": {"black": 0, "red": 0, "white": 0, "blue": 3, "green": 0}},
    {"id": 32, "level": 1, "bonus": "green", "points": 1, "cost": {"black": 0, "red": 0, "white": 0, "blue": 4, "green": 0}},
    # Red bonus cards
    {"id": 33, "level": 1, "bonus": "red",   "points": 0, "cost": {"black": 0, "red": 0, "white": 1, "blue": 1, "green": 1}},
    {"id": 34, "level": 1, "bonus": "red",   "points": 0, "cost": {"black": 0, "red": 0, "white": 0, "blue": 2, "green": 1}},
    {"id": 35, "level": 1, "bonus": "red",   "points": 0, "cost": {"black": 1, "red": 0, "white": 0, "blue": 1, "green": 1}},
    {"id": 36, "level": 1, "bonus": "red",   "points": 0, "cost": {"black": 0, "red": 0, "white": 2, "blue": 0, "green": 1}},
    {"id": 37, "level": 1, "bonus": "red",   "points": 0, "cost": {"black": 2, "red": 0, "white": 0, "blue": 2, "green": 0}},
    {"id": 38, "level": 1, "bonus": "red",   "points": 0, "cost": {"black": 0, "red": 0, "white": 2, "blue": 0, "green": 0}},
    {"id": 39, "level": 1, "bonus": "red",   "points": 0, "cost": {"black": 0, "red": 0, "white": 3, "blue": 0, "green": 0}},
    {"id": 40, "level": 1, "bonus": "red",   "points": 1, "cost": {"black": 0, "red": 0, "white": 0, "blue": 0, "green": 4}},
]

# Level 2 cards (30 total)
LEVEL2_CARDS = [
    # Black bonus
    {"id": 41, "level": 2, "bonus": "black", "points": 1, "cost": {"black": 3, "red": 2, "white": 2, "blue": 0, "green": 0}},
    {"id": 42, "level": 2, "bonus": "black", "points": 1, "cost": {"black": 0, "red": 3, "white": 0, "blue": 0, "green": 2}},
    {"id": 43, "level": 2, "bonus": "black", "points": 2, "cost": {"black": 0, "red": 0, "white": 1, "blue": 4, "green": 2}},
    {"id": 44, "level": 2, "bonus": "black", "points": 2, "cost": {"black": 0, "red": 3, "white": 0, "blue": 0, "green": 3}},
    {"id": 45, "level": 2, "bonus": "black", "points": 2, "cost": {"black": 5, "red": 0, "white": 0, "blue": 0, "green": 0}},
    {"id": 46, "level": 2, "bonus": "black", "points": 3, "cost": {"black": 6, "red": 0, "white": 0, "blue": 0, "green": 0}},
    # Blue bonus
    {"id": 47, "level": 2, "bonus": "blue",  "points": 1, "cost": {"black": 0, "red": 2, "white": 3, "blue": 0, "green": 2}},
    {"id": 48, "level": 2, "bonus": "blue",  "points": 1, "cost": {"black": 0, "red": 0, "white": 2, "blue": 3, "green": 0}},
    {"id": 49, "level": 2, "bonus": "blue",  "points": 2, "cost": {"black": 1, "red": 4, "white": 2, "blue": 0, "green": 0}},
    {"id": 50, "level": 2, "bonus": "blue",  "points": 2, "cost": {"black": 3, "red": 0, "white": 0, "blue": 3, "green": 0}},
    {"id": 51, "level": 2, "bonus": "blue",  "points": 2, "cost": {"black": 0, "red": 0, "white": 0, "blue": 5, "green": 0}},
    {"id": 52, "level": 2, "bonus": "blue",  "points": 3, "cost": {"black": 0, "red": 0, "white": 0, "blue": 6, "green": 0}},
    # White bonus
    {"id": 53, "level": 2, "bonus": "white", "points": 1, "cost": {"black": 2, "red": 0, "white": 0, "blue": 3, "green": 2}},
    {"id": 54, "level": 2, "bonus": "white", "points": 1, "cost": {"black": 0, "red": 0, "white": 2, "blue": 0, "green": 3}},
    {"id": 55, "level": 2, "bonus": "white", "points": 2, "cost": {"black": 0, "red": 2, "white": 0, "blue": 4, "green": 1}},
    {"id": 56, "level": 2, "bonus": "white", "points": 2, "cost": {"black": 0, "red": 3, "white": 3, "blue": 0, "green": 0}},
    {"id": 57, "level": 2, "bonus": "white", "points": 2, "cost": {"black": 0, "red": 0, "white": 5, "blue": 0, "green": 0}},
    {"id": 58, "level": 2, "bonus": "white", "points": 3, "cost": {"black": 0, "red": 0, "white": 6, "blue": 0, "green": 0}},
    # Green bonus
    {"id": 59, "level": 2, "bonus": "green", "points": 1, "cost": {"black": 0, "red": 2, "white": 0, "blue": 2, "green": 3}},
    {"id": 60, "level": 2, "bonus": "green", "points": 1, "cost": {"black": 3, "red": 0, "white": 2, "blue": 0, "green": 0}},
    {"id": 61, "level": 2, "bonus": "green", "points": 2, "cost": {"black": 0, "red": 0, "white": 4, "blue": 2, "green": 1}},
    {"id": 62, "level": 2, "bonus": "green", "points": 2, "cost": {"black": 0, "red": 0, "white": 0, "blue": 3, "green": 3}},
    {"id": 63, "level": 2, "bonus": "green", "points": 2, "cost": {"black": 0, "red": 5, "white": 0, "blue": 0, "green": 0}},
    {"id": 64, "level": 2, "bonus": "green", "points": 3, "cost": {"black": 0, "red": 0, "white": 0, "blue": 0, "green": 6}},
    # Red bonus
    {"id": 65, "level": 2, "bonus": "red",   "points": 1, "cost": {"black": 2, "red": 0, "white": 2, "blue": 3, "green": 0}},
    {"id": 66, "level": 2, "bonus": "red",   "points": 1, "cost": {"black": 0, "red": 0, "white": 3, "blue": 0, "green": 2}},
    {"id": 67, "level": 2, "bonus": "red",   "points": 2, "cost": {"black": 2, "red": 0, "white": 0, "blue": 1, "green": 4}},
    {"id": 68, "level": 2, "bonus": "red",   "points": 2, "cost": {"black": 3, "red": 3, "white": 0, "blue": 0, "green": 0}},
    {"id": 69, "level": 2, "bonus": "red",   "points": 2, "cost": {"black": 0, "red": 5, "white": 0, "blue": 0, "green": 0}},
    {"id": 70, "level": 2, "bonus": "red",   "points": 3, "cost": {"black": 0, "red": 6, "white": 0, "blue": 0, "green": 0}},
]

# Level 3 cards (20 total)
LEVEL3_CARDS = [
    {"id": 71, "level": 3, "bonus": "black", "points": 3, "cost": {"black": 3, "red": 3, "white": 3, "blue": 5, "green": 3}},
    {"id": 72, "level": 3, "bonus": "black", "points": 4, "cost": {"black": 0, "red": 0, "white": 7, "blue": 0, "green": 0}},
    {"id": 73, "level": 3, "bonus": "black", "points": 4, "cost": {"black": 3, "red": 0, "white": 6, "blue": 3, "green": 0}},
    {"id": 74, "level": 3, "bonus": "black", "points": 5, "cost": {"black": 7, "red": 0, "white": 0, "blue": 0, "green": 0}},
    {"id": 75, "level": 3, "bonus": "blue",  "points": 3, "cost": {"black": 3, "red": 0, "white": 3, "blue": 3, "green": 5}},
    {"id": 76, "level": 3, "bonus": "blue",  "points": 4, "cost": {"black": 7, "red": 0, "white": 0, "blue": 0, "green": 0}},
    {"id": 77, "level": 3, "bonus": "blue",  "points": 4, "cost": {"black": 6, "red": 3, "white": 0, "blue": 0, "green": 3}},
    {"id": 78, "level": 3, "bonus": "blue",  "points": 5, "cost": {"black": 0, "red": 0, "white": 0, "blue": 7, "green": 0}},
    {"id": 79, "level": 3, "bonus": "white", "points": 3, "cost": {"black": 3, "red": 5, "white": 3, "blue": 3, "green": 0}},
    {"id": 80, "level": 3, "bonus": "white", "points": 4, "cost": {"black": 0, "red": 0, "white": 0, "blue": 7, "green": 0}},
    {"id": 81, "level": 3, "bonus": "white", "points": 4, "cost": {"black": 3, "red": 0, "white": 3, "blue": 6, "green": 3}},
    {"id": 82, "level": 3, "bonus": "white", "points": 5, "cost": {"black": 0, "red": 0, "white": 7, "blue": 0, "green": 0}},
    {"id": 83, "level": 3, "bonus": "green", "points": 3, "cost": {"black": 5, "red": 3, "white": 0, "blue": 3, "green": 3}},
    {"id": 84, "level": 3, "bonus": "green", "points": 4, "cost": {"black": 0, "red": 7, "white": 0, "blue": 0, "green": 0}},
    {"id": 85, "level": 3, "bonus": "green", "points": 4, "cost": {"black": 0, "red": 6, "white": 3, "blue": 0, "green": 3}},
    {"id": 86, "level": 3, "bonus": "green", "points": 5, "cost": {"black": 0, "red": 0, "white": 0, "blue": 0, "green": 7}},
    {"id": 87, "level": 3, "bonus": "red",   "points": 3, "cost": {"black": 3, "red": 3, "white": 5, "blue": 3, "green": 0}},
    {"id": 88, "level": 3, "bonus": "red",   "points": 4, "cost": {"black": 0, "red": 0, "white": 0, "blue": 0, "green": 7}},
    {"id": 89, "level": 3, "bonus": "red",   "points": 4, "cost": {"black": 0, "red": 3, "white": 0, "blue": 3, "green": 6}},
    {"id": 90, "level": 3, "bonus": "red",   "points": 5, "cost": {"black": 0, "red": 7, "white": 0, "blue": 0, "green": 0}},
]

ALL_CARDS = LEVEL1_CARDS + LEVEL2_CARDS + LEVEL3_CARDS

# Noble tiles (10 total)
# Each noble requires specific bonus counts to visit
NOBLES = [
    {"id": 1,  "points": 3, "requirements": {"white": 3, "blue": 3, "green": 3, "red": 0,  "black": 0}},
    {"id": 2,  "points": 3, "requirements": {"white": 3, "blue": 3, "green": 0, "red": 0,  "black": 3}},
    {"id": 3,  "points": 3, "requirements": {"white": 0, "blue": 3, "green": 3, "red": 3,  "black": 0}},
    {"id": 4,  "points": 3, "requirements": {"white": 0, "blue": 0, "green": 3, "red": 3,  "black": 3}},
    {"id": 5,  "points": 3, "requirements": {"white": 3, "blue": 0, "green": 0, "red": 3,  "black": 3}},
    {"id": 6,  "points": 3, "requirements": {"white": 4, "blue": 4, "green": 0, "red": 0,  "black": 0}},
    {"id": 7,  "points": 3, "requirements": {"white": 4, "blue": 0, "green": 0, "red": 0,  "black": 4}},
    {"id": 8,  "points": 3, "requirements": {"white": 0, "blue": 4, "green": 4, "red": 0,  "black": 0}},
    {"id": 9,  "points": 3, "requirements": {"white": 0, "blue": 0, "green": 4, "red": 4,  "black": 0}},
    {"id": 10, "points": 3, "requirements": {"white": 0, "blue": 0, "green": 0, "red": 4,  "black": 4}},
]
