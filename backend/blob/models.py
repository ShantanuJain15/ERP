from django.conf import settings
from django.db import models

# Create your models here. It is best practice to create a Custom User model even if you don't need to extend it right now.
class MetaDataBlob(models.Model):
    id=models.AutoField(primary_key=True)
    file_path = models.CharField(max_length=512 ,null=True, blank=True)
    file_name = models.CharField(max_length=255,db_column='name')
    data = models.JSONField()
    owner=models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blobs')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # def save(self, *args, **kwargs):
    #     if self.discount_price is None:
    #         self.discount_price = self.price * 0.9
    #     super().save(*args, **kwargs)

    def __str__(self):
        return self.file_name