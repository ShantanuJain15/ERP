# from django.db import models

# Create your models here.


from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    # Add custom fields here
    is_verified = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=15, blank=True)