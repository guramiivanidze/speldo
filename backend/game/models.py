import uuid
from django.db import models
from django.contrib.auth.models import User


class Game(models.Model):
    STATUS_WAITING = 'waiting'
    STATUS_PLAYING = 'playing'
    STATUS_FINISHED = 'finished'
    STATUS_CHOICES = [
        (STATUS_WAITING, 'Waiting'),
        (STATUS_PLAYING, 'Playing'),
        (STATUS_FINISHED, 'Finished'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=6, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_WAITING)
    max_players = models.IntegerField(default=4)
    current_player_index = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

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

    class Meta:
        ordering = ['order']
        unique_together = [('game', 'user'), ('game', 'order')]

    def __str__(self):
        return f"{self.user.username} in game {self.game.code}"
