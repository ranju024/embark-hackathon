from django.contrib import admin
from .models import WardSchedule, ScheduleNotice

# Register your models here.
admin.site.register(WardSchedule)
admin.site.register(ScheduleNotice)