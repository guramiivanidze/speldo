import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class DevelopmentCard(models.Model):
    """Development cards that can be purchased or reserved."""
    LEVEL_CHOICES = [(1, 'Level 1'), (2, 'Level 2'), (3, 'Level 3')]
    BONUS_CHOICES = [
        ('white', 'White (Diamond)'),
        ('blue', 'Blue (Sapphire)'),
        ('green', 'Green (Emerald)'),
        ('red', 'Red (Ruby)'),
        ('black', 'Black (Onyx)'),
    ]

    level = models.IntegerField(choices=LEVEL_CHOICES)
    bonus = models.CharField(max_length=10, choices=BONUS_CHOICES)
    points = models.IntegerField(default=0)
    
    # Cost in each gem type
    cost_white = models.IntegerField(default=0)
    cost_blue = models.IntegerField(default=0)
    cost_green = models.IntegerField(default=0)
    cost_red = models.IntegerField(default=0)
    cost_black = models.IntegerField(default=0)
    
    # Visual customization
    background_image = models.ImageField(upload_to='cards/', blank=True, null=True, help_text="Card background image")
    
    class Meta:
        ordering = ['level', 'bonus', 'id']

    def __str__(self):
        return f"L{self.level} {self.bonus.title()} ({self.points}pts)"

    @property
    def cost(self):
        """Return cost as a dict for compatibility."""
        return {
            'white': self.cost_white,
            'blue': self.cost_blue,
            'green': self.cost_green,
            'red': self.cost_red,
            'black': self.cost_black,
        }


class Noble(models.Model):
    """Noble tiles that visit players with enough bonuses."""
    points = models.IntegerField(default=3)
    
    # Required bonuses
    req_white = models.IntegerField(default=0)
    req_blue = models.IntegerField(default=0)
    req_green = models.IntegerField(default=0)
    req_red = models.IntegerField(default=0)
    req_black = models.IntegerField(default=0)
    
    # Visual customization
    background_image = models.ImageField(upload_to='nobles/', blank=True, null=True, help_text="Noble background image")
    name = models.CharField(max_length=100, blank=True, help_text="Optional noble name")

    def __str__(self):
        reqs = []
        if self.req_white: reqs.append(f"W{self.req_white}")
        if self.req_blue: reqs.append(f"B{self.req_blue}")
        if self.req_green: reqs.append(f"G{self.req_green}")
        if self.req_red: reqs.append(f"R{self.req_red}")
        if self.req_black: reqs.append(f"K{self.req_black}")
        return f"Noble ({'/'.join(reqs)}) - {self.points}pts"

    @property
    def requirements(self):
        """Return requirements as a dict for compatibility."""
        return {
            'white': self.req_white,
            'blue': self.req_blue,
            'green': self.req_green,
            'red': self.req_red,
            'black': self.req_black,
        }


class Game(models.Model):
    STATUS_WAITING = 'waiting'
    STATUS_PLAYING = 'playing'
    STATUS_PAUSED = 'paused'
    STATUS_FINISHED = 'finished'
    STATUS_CHOICES = [
        (STATUS_WAITING, 'Waiting'),
        (STATUS_PLAYING, 'Playing'),
        (STATUS_PAUSED, 'Paused'),
        (STATUS_FINISHED, 'Finished'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=6, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_WAITING)
    max_players = models.IntegerField(default=4)
    current_player_index = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Pause state fields
    paused_at = models.DateTimeField(null=True, blank=True)
    pause_expires_at = models.DateTimeField(null=True, blank=True)
    left_player_id = models.IntegerField(null=True, blank=True)  # User ID who left
    
    # Vote tracking for end/wait survey (JSON: {user_id: "wait"|"end"})
    player_votes = models.JSONField(default=dict)
    last_survey_at = models.DateTimeField(null=True, blank=True)

    # Game state stored as JSON
    # tokens_in_bank: {"white":7,"blue":7,"green":7,"red":7,"black":7,"gold":5}
    tokens_in_bank = models.JSONField(default=dict)
    # visible_cards: {"1": [card_id, ...], "2": [...], "3": [...]}
    visible_cards = models.JSONField(default=dict)
    # decks: {"1": [card_id, ...], "2": [...], "3": [...]}
    decks = models.JSONField(default=dict)
    # available_nobles: [noble_id, ...]
    available_nobles = models.JSONField(default=list)

    last_round_triggered_by = models.IntegerField(null=True, blank=True)
    winner = models.ForeignKey(
        User, null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='won_games'
    )

    def __str__(self):
        return f"Game {self.code} ({self.status})"


class GamePlayer(models.Model):
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='players')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    order = models.IntegerField()  # 0-indexed turn order

    # tokens held: {"white":0,"blue":0,"green":0,"red":0,"black":0,"gold":0}
    tokens = models.JSONField(default=dict)
    # purchased card ids
    purchased_card_ids = models.JSONField(default=list)
    # reserved card ids (max 3)
    reserved_card_ids = models.JSONField(default=list)
    # noble ids acquired
    noble_ids = models.JSONField(default=list)

    prestige_points = models.IntegerField(default=0)
    
    # Online/connection status
    is_online = models.BooleanField(default=True)
    left_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['order']
        unique_together = [('game', 'user'), ('game', 'order')]

    def __str__(self):
        return f"{self.user.username} in game {self.game.code}"
