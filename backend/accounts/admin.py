from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

admin.site.register(User, UserAdmin) # Register your models here. User is the custom user model and UserAdmin is the default admin interface for user model.Basically 
                                    #UserAdmin is the model for managing user in admin interface
